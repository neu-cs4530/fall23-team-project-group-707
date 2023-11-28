import {
  Button,
  Container,
  Flex,
  Image,
  Input,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  useToast,
} from '@chakra-ui/react';
import React, { useState } from 'react';
import { Song } from '../../types/CoveyTownSocket';
import { searchSong } from './YoutubeSearch';
import assert from 'assert';
import useTownController from '../../hooks/useTownController';

type SuggestionFormWrapperProps = {
  isOpen: boolean;
  handleClose: () => void;
};

type SuggestionFormProps = {
  handleClose: () => void;
};

type ResultsContainerProps = {
  songs: Song[];
  onClickHandler: (song: Song) => void;
};
type ResultCardProps = {
  song: Song;
  onClickHandler: (song: Song) => void;
};

function ResultCard({ song, onClickHandler }: ResultCardProps): JSX.Element {
  const resultCardStyle: React.CSSProperties = {
    flex: `1`,

    display: 'flex',
    flexDirection: 'row',

    height: '100px',
  };
  const imageStyles: React.CSSProperties = {
    flex: `1`,

    overflowY: 'clip',
  };
  const songInfoStyle: React.CSSProperties = {
    flex: `1`,

    display: 'flex',
    flexDirection: 'column',
    overflowY: 'clip',
  };

  return (
    <div
      className='resultCard'
      onClick={() => {
        onClickHandler(song);
      }}
      style={resultCardStyle}>
      <Image
        style={imageStyles}
        className='thumbnail'
        src={`https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`}
        alt=''
      />
      <div className='songInfo' style={songInfoStyle}>
        <p className='name'>{song.songName}</p>
        <p className='artist'>{song.artistName}</p>
      </div>
    </div>
  );
}

function ResultsContainer({ songs, onClickHandler }: ResultsContainerProps): JSX.Element {
  const resultsContainerStyles: React.CSSProperties = {
    flex: '4 1 4',

    display: 'flex',
    flexDirection: 'column',
    minWidth: '100%',
    maxHeight: '100%',

    overflowY: 'scroll',
  };

  return (
    <div style={resultsContainerStyles}>
      {songs.map(song => {
        return <ResultCard key={song.videoId} song={song} onClickHandler={onClickHandler} />;
      })}
    </div>
  );
}

/* This is the modal content and what the user sees and interacts with. */
export function SuggestionForm({ handleClose }: SuggestionFormProps): JSX.Element {
  const townController = useTownController();
  const [songName, setSongName] = React.useState('');
  const [artistName] = React.useState('');
  const [results, setResults] = React.useState<Song[]>([]);
  const [song, setSong] = useState<Song>();
  const toast = useToast();

  const resultsClickHandler = (result: Song) => {
    setSong(result);
  };
  const searchEventHandler = async () => {
    const youtubeApiKey = process.env.NEXT_PUBLIC_TOWN_YOUTUBE_API_KEY;
    assert(youtubeApiKey, 'NEXT_PUBLIC_TOWN_YOUTUBE_API_KEY must be defined');
    try {
      const songs: Song[] = await searchSong({ songName, artistName, youtubeApiKey });
      setResults(songs);
    } catch (error) {
      toast({
        title: 'Error searching for song',
        description: (error as Error).toString(),
        status: 'error',
      });
    }
  };
  const queueEventHandler = async () => {
    try {
      if (song === undefined) {
        throw new Error('Song is not defined');
      }

      // We use the townController hook here so we can get the JukeboxArea and send the queue command to the backend.
      const controller = townController.jukeboxAreas.find(jukeboxAreaController => {
        if (jukeboxAreaController.occupantsByID.includes(townController.ourPlayer.id)) {
          return jukeboxAreaController;
        }
      });

      if (controller === undefined) {
        throw new Error('Area does not exist');
      } else {
        controller.queueSong(song);
      }
    } catch (error) {
      toast({
        title: 'Error queueing song',
        description: (error as Error).toString(),
        status: 'error',
      });
    }
  };

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',

    padding: '0',
  };
  const resultsContainerStyles: React.CSSProperties = {
    flex: '4 1 4',

    display: 'flex',
    flexDirection: 'column',
    minWidth: '100%',
    maxHeight: '100%',

    overflowY: 'scroll',
  };
  const searchBarStyles: React.CSSProperties = {
    flex: '1',

    display: 'flex',
    flexDirection: 'row',
  };
  const queueButtonStyles: React.CSSProperties = {
    flex: '1',
  };

  return (
    <Container aria-label='suggestionFormContainer' style={containerStyles}>
      <div style={searchBarStyles}>
        <Input
          aria-label='songName'
          placeholder='Song & Artist'
          onChange={event => {
            setSongName(event.target.value);
          }}
          onKeyDown={event => {
            // The character model will move around if we don't stop the key event propagation.
            event.stopPropagation();
          }}
        />
        <Button aria-label='search' onClick={searchEventHandler}>
          Search
        </Button>
      </div>
      <div style={resultsContainerStyles}>
        {results.map(result => {
          return (
            <ResultCard key={result.videoId} song={result} onClickHandler={resultsClickHandler} />
          );
        })}
      </div>
      <Button style={queueButtonStyles} onClick={queueEventHandler}>
        Add to Queue
      </Button>
      {/* <Button aria-label='close' onClick={handleClose}>
        X
      </Button> */}
    </Container>
  );
}

/* This is the wrapper for our form. It returns the modal component containing the main component implementing the suggestion features. */
export default function SuggestionFormWrapper({
  isOpen,
  handleClose,
}: SuggestionFormWrapperProps): JSX.Element {
  return (
    <Modal isOpen={isOpen} onClose={handleClose} closeOnOverlayClick={false}>
      <ModalOverlay style={{ backgroundColor: 'rgba(0, 0, 0, 0.93)' }} />
      <ModalContent
        style={{
          padding: '20px',
          height: `calc(max(80vh, 700px))`,
          maxWidth: `calc(max(30vw, 550px))`,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100%',
        }}>
        <SuggestionForm handleClose={handleClose} />
      </ModalContent>
    </Modal>
  );
}
