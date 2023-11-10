import { ITiledMapObject } from '@jonbell/tiled-map-type-guard';
import {
  BoundingBox,
  InteractableCommand,
  InteractableCommandReturnType,
  JukeboxArea as JukeboxAreaModel,
  TownEmitter,
} from '../../types/CoveyTownSocket';
import InteractableArea from '../InteractableArea';
import Jukebox from './Jukebox';
import ViewingArea from '../ViewingArea';

/**
 * Represents an interactable area on the map that contains a Jukebox.
 */
export default class JukeboxArea extends InteractableArea {
  private _jukebox: Jukebox = new Jukebox(undefined, []);

  private _viewingArea: ViewingArea;

  public constructor(
    id: string,
    { x, y, width, height }: BoundingBox,
    townEmitter: TownEmitter,
    viewingArea: ViewingArea,
  ) {
    super(id, { x, y, width, height }, townEmitter);

    this._viewingArea = viewingArea;
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
      this._emitAreaChanged();

      return undefined as InteractableCommandReturnType<CommandType>;
    }

    if (command.type === 'VoteOnSongInQueue') {
      this._jukebox.voteOnSongInQueue(command.song, command.vote);
      this._emitAreaChanged();

      return undefined as InteractableCommandReturnType<CommandType>;
    }

    // pass to viewing area's handle method if it's none of the jukebox commands
    // if not a valid command, this will throw an error
    return this._viewingArea.handleCommand(command);
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
