import { render, screen, waitFor } from '@testing-library/react';
import { SuggestionForm } from './SuggestionForm';
import JukeboxAreaController from '../../classes/interactable/JukeboxAreaController';
import { nanoid } from 'nanoid';
import TownController from '../../classes/TownController';
import React from 'react';
// keep for testing/mocking
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import useLoginController from '../../hooks/useLoginController';
import { JukeboxArea, Song } from '../../types/CoveyTownSocket';
import * as YoutubeSearch from './YoutubeSearch';
import userEvent from '@testing-library/user-event';
// keep for testing/mocking
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useToast } from '@chakra-ui/react';
import { LoginController } from '../../contexts/LoginControllerContext';
jest.mock('../../classes/TownController');
jest.mock('../../classes/interactable/JukeboxAreaController');
jest.mock('../Town/interactables/JukeboxArea');
jest.mock('../../hooks/useLoginController');
jest.mock('./YoutubeSearch');

/* MOCKS AND SPIYES */
let consoleErrorSpy: jest.SpyInstance<void, [message?: any, ...optionalParms: any[]]>;
let mockJukeboxAreaController: JukeboxAreaController;
let jukeboxAreaQueueSongSpy: jest.SpyInstance<Promise<void>, [song: Song]>;
let searchApiClientSpy: jest.SpyInstance<Promise<Song[]>>;
const mockToast = jest.fn();
jest.mock('@chakra-ui/react', () => {
  // We mock the toast functionality.
  const ui = jest.requireActual('@chakra-ui/react');
  const mockUseToast = () => mockToast;
  return {
    ...ui,
    useToast: mockUseToast,
  };
});

//  Set up
beforeAll(() => {
  // Spy on console.error and intercept react key warnings to fail test
  consoleErrorSpy = jest.spyOn(global.console, 'error');
  consoleErrorSpy.mockImplementation((message?, ...optionalParams) => {
    const stringMessage = message as string;
    if (stringMessage.includes && stringMessage.includes('children with the same key,')) {
      throw new Error(stringMessage.replace('%s', optionalParams[0]));
    } else if (stringMessage.includes && stringMessage.includes('warning-keys')) {
      throw new Error(stringMessage.replace('%s', optionalParams[0]));
    }
    // eslint-disable-next-line no-console -- we are wrapping the console with a spy to find react warnings
    console.warn(message, ...optionalParams);
  });

  // The Suggestion form takes a JukeboxAreaController as a prop so we mock the controller.
  mockJukeboxAreaController = new JukeboxAreaController(
    nanoid(),
    {} as JukeboxArea,
    new TownController({
      userName: nanoid(),
      townID: nanoid(),
      loginController: {} as LoginController,
    }),
  );
  jukeboxAreaQueueSongSpy = jest.spyOn(mockJukeboxAreaController, 'queueSong');

  // This is the spy and mock of the api client.
  searchApiClientSpy = jest.spyOn(YoutubeSearch, 'searchSong');
  searchApiClientSpy.mockImplementation(() => {
    return new Promise(resolve => {
      // eslint-disable-next-line prettier/prettier
      resolve((null as unknown) as Song[]);
    });
  });
});

// Let's reset the mocks before each test.
beforeEach(() => {
  jest.resetAllMocks();
});

// Let's restore the mocks when we're done.
afterAll(() => {
  jest.restoreAllMocks();
});

describe('Suggestion form', () => {
  describe('Search Button', () => {
    it('should call the Youtube Search API client with the current state when clicked', async () => {
      render(<SuggestionForm controller={mockJukeboxAreaController}></SuggestionForm>);

      const searchButton = await screen.findByLabelText('search');

      await userEvent.click(searchButton);

      expect(searchApiClientSpy).toBeCalledTimes(1);
      expect(searchApiClientSpy).toBeCalledWith({
        artistName: '',
        songName: '',
        youtubeApiKey: undefined,
      });
    });
    it('should call the Youtube Search API client with updated states when clicked', async () => {
      render(<SuggestionForm controller={mockJukeboxAreaController}></SuggestionForm>);

      const searchButton = await screen.findByLabelText('search');
      const songNameInput = await screen.findByLabelText('songName');
      const artistInput = await screen.findByLabelText('artistName');

      await userEvent.type(songNameInput, 'rich baby daddy');
      await userEvent.type(artistInput, 'drake');
      await userEvent.click(searchButton);

      expect(searchApiClientSpy).toBeCalledTimes(1);
      expect(searchApiClientSpy).toBeCalledWith({
        artistName: 'drake',
        songName: 'rich baby daddy',
        youtubeApiKey: undefined,
      });
    });
    it('should show a toast when the api call fails', async () => {
      searchApiClientSpy.mockImplementationOnce(() => {
        throw new Error('API Call fails. testing.');
      });

      render(<SuggestionForm controller={mockJukeboxAreaController}></SuggestionForm>);

      const searchButton = await screen.findByLabelText('search');

      await userEvent.click(searchButton);

      expect(mockToast).toBeCalledWith(
        expect.objectContaining({
          description: `Error: API Call fails. testing.`,
          status: 'error',
        }),
      );
    });
  });
  describe('Queue Button', () => {
    it('should show a toast when the user has not selected a song', async () => {
      render(<SuggestionForm controller={mockJukeboxAreaController}></SuggestionForm>);

      const queueButton = await screen.findByLabelText('queue');

      await userEvent.click(queueButton);

      expect(mockToast).toBeCalledWith(
        expect.objectContaining({
          description: 'Error: Song is not defined',
          status: 'error',
          title: 'Error queueing song',
        }),
      );
      expect(jukeboxAreaQueueSongSpy).not.toBeCalled();
    });
    it('should call the JukeboxAreaController queueSong() method with the song state', async () => {
      searchApiClientSpy.mockImplementationOnce(() => {
        return new Promise(resolve => {
          resolve([{ songName: 'testing song', artistName: 'and queue', videoId: 'and button' }]);
        });
      });

      render(<SuggestionForm controller={mockJukeboxAreaController}></SuggestionForm>);

      const searchButton = await screen.findByLabelText('search');
      await userEvent.click(searchButton);

      const firstResult = screen.getByText('testing song');
      await userEvent.click(firstResult);

      const queueButton = await screen.findByLabelText('queue');
      await userEvent.click(queueButton);

      expect(jukeboxAreaQueueSongSpy).toBeCalled();
      expect(jukeboxAreaQueueSongSpy).toBeCalledWith({
        songName: 'testing song',
        artistName: 'and queue',
        videoId: 'and button',
      });
    });
  });
});
