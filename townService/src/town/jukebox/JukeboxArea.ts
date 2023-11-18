import { ITiledMapObject } from '@jonbell/tiled-map-type-guard';
import {
  BoundingBox,
  InteractableCommand,
  InteractableCommandReturnType,
  JukeboxArea as JukeboxAreaModel,
  Song,
  TownEmitter,
  ViewingArea as ViewingAreaModel,
} from '../../types/CoveyTownSocket';
import InteractableArea from '../InteractableArea';
import Jukebox from './Jukebox';
import ViewingArea from '../ViewingArea';
import Player from '../../lib/Player';
import InvalidParametersError from '../../lib/InvalidParametersError';

/**
 * Represents an interactable area on the map that contains a Jukebox.
 */
export default class JukeboxArea extends InteractableArea {
  private _jukebox: Jukebox;

  private _viewingArea: ViewingArea;

  public constructor(
    id: string,
    { x, y, width, height }: BoundingBox,
    townEmitter: TownEmitter,
    viewingArea: ViewingArea,
  ) {
    super(id, { x, y, width, height }, townEmitter);

    this._viewingArea = viewingArea;
    this._jukebox = new Jukebox(undefined, []);
  }

  /**
   * Provides the model representation of the state of jukebox in the interactable area.
   * @returns the model representation of the jukebox property
   */
  public toModel(): JukeboxAreaModel {
    return {
      id: this.id,
      occupants: this.occupantsByID,
      type: 'JukeboxArea',
      curSong: this._jukebox.curSong,
      queue: this._jukebox.queue,
      videoPlayer: this._viewingArea.toModel(),
    };
  }

  public get isActive(): boolean {
    return true;
  }

  /**
   * Updates the state of this ViewingArea, setting the video, isPlaying and progress properties
   *
   * @param viewingArea updated model
   */
  public updateModel(newViewingAreaModel: ViewingAreaModel) {
    this._viewingArea.updateModel(newViewingAreaModel);
  }

  /**
   * Adds a new player to this interactable area.
   *
   * Adds the player to this area's occupants array, sets the player's interactableID, informs players in the town
   * that the player's interactableID has changed, and informs players in the town that the area has changed.
   *
   * Assumes that the player specified is a member of this town.
   *
   * @param player Player to add
   */
  public add(player: Player): void {
    super.add(player);
    this._viewingArea.add(player);
  }

  /**
   * Removes a player from this interactable area.
   *
   * Removes the player from this area's occupants array, clears the player's interactableID, informs players in the town
   * that the player's interactableID has changed, and informs players in the town that the area has changed
   *
   * Assumes that the player specified is an occupant of this interactable area
   *
   * @param player Player to remove
   */
  public remove(player: Player): void {
    super.remove(player);
    this._viewingArea.remove(player);
  }

  /**
   * Given a list of players, adds all of the players that are within this interactable area
   *
   * @param allPlayers list of players to examine and potentially add to this interactable area
   */
  public addPlayersWithinBounds(allPlayers: Player[]) {
    super.addPlayersWithinBounds(allPlayers);
    this._viewingArea.addPlayersWithinBounds(allPlayers);
  }

  /**
   * Creates a youtube video URL using the videoID property of the given song
   *
   * @param song to create URL for
   * @returns formatted URL if there's a song, or undefined if the provided song is undefined
   */
  private _formatSongURL(song: Song | undefined): string | undefined {
    const youtubeURL = 'https://www.youtube.com/watch?v=';

    if (song) {
      return `${youtubeURL}${song.videoId}`;
    }

    return undefined;
  }

  /**
   * Plays the next song in the Jukebox queue if:
   *    - there is no song currently playing, and there's a song in the queue
   *    OR
   *    - the song video in the provided viewingAreaModel is not playing anymore, and has
   *      played for more than 0 seconds (the song has 'ended')
   *
   * @param viewingAreaModel to check if the song playing has ended
   * @returns a new viewing area model with the next song if there's an update, else undefined
   *          if the next song is being played
   */
  private _playNextSong(viewingAreaModel: ViewingAreaModel): ViewingAreaModel | undefined {
    if (
      (this._jukebox.curSong === undefined && this._jukebox.queue.length !== 0) ||
      (!viewingAreaModel.isPlaying && viewingAreaModel.elapsedTimeSec !== 0)
    ) {
      this._jukebox.playNextSongInQueue();

      return {
        id: this.id,
        occupants: this.occupantsByID,
        type: 'ViewingArea',
        video: this._formatSongURL(this._jukebox.curSong),
        isPlaying: this._jukebox.curSong !== undefined,
        elapsedTimeSec: 0,
      };
    }

    return undefined;
  }

  /**
   * Handles commands sent to the JukeboxArea by a user in this interactable area.
   *
   * Supported commands:
   * - AddSongToQueue -> adds the provided song to the jukebox's queue
   * - VoteOnSongInQueue -> casts the provided vote on the given song in the queue
   *
   * If the command is successful (does not throw an error), calls this._emitAreaChanged (necessary
   *  to notify any listeners of a state update)
   * If the command is unsuccessful (throws an error), the error is propagated to the caller
   *
   * @param command represents the command to handle
   * @param player player making the request
   * @returns the interactable command return type defined for the respective command
   *  (undefined for the currently supported commands)
   * - InvalidParametersError if the command is not supported or is invalid
   * - Any command besides AddSongToQueue, VoteOnSongInQueue: INVALID_COMMAND_MESSAGE
   */
  public handleCommand<CommandType extends InteractableCommand>(
    command: CommandType,
  ): InteractableCommandReturnType<CommandType> {
    if (command.type === 'AddSongToQueue') {
      this._jukebox.addSongToQueue(command.song);

      const newViewingAreaModel: ViewingAreaModel | undefined = this._playNextSong(
        this._viewingArea.toModel(),
      );

      if (newViewingAreaModel) {
        this.updateModel(newViewingAreaModel);
      }

      this._emitAreaChanged();

      return undefined as InteractableCommandReturnType<CommandType>;
    }

    if (command.type === 'VoteOnSongInQueue') {
      this._jukebox.voteOnSongInQueue(command.song, command.vote);
      this._emitAreaChanged();

      return undefined as InteractableCommandReturnType<CommandType>;
    }

    if (command.type === 'ViewingAreaUpdate') {
      const newViewingAreaModel: ViewingAreaModel | undefined = this._playNextSong(command.update);

      // if there is a next song to play, then we update the viewing area with
      // the model so that it can play the next song
      if (newViewingAreaModel) {
        this.updateModel(newViewingAreaModel);
        this._emitAreaChanged();

        return {} as InteractableCommandReturnType<CommandType>;
      }

      // pass to viewing area's handle method if it's none of the jukebox commands
      // or a viewing area command
      // if not a valid command, this will throw an error
      return this._viewingArea.handleCommand(command);
    }

    throw new InvalidParametersError('Unknown command type');
  }

  /**
   * Creates a new JukeboxArea object that will represent a Jukebox Area object in the town map.
   *
   * @param mapObject An ITiledMapObject that represents a rectangle in which this conversation area exists
   * @param broadcastEmitter An emitter that can be used by this conversation area to broadcast updates
   * @returns a new Jukebox area with the bounding box created from the input map object nad broadcastEmitter
   * @throws error if the area is not correctly formed
   */
  public static fromMapObject(
    mapObject: ITiledMapObject,
    broadcastEmitter: TownEmitter,
  ): JukeboxArea {
    const { name, width, height } = mapObject;

    if (!width || !height) {
      throw new Error(`Malformed viewing area ${name}`);
    }

    const rect: BoundingBox = { x: mapObject.x, y: mapObject.y, width, height };

    const viewingArea = ViewingArea.fromMapObject(mapObject, broadcastEmitter);

    return new JukeboxArea(name, rect, broadcastEmitter, viewingArea);
  }
}
