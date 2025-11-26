import { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceRecognitionResult {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
}

export function useVoiceRecognition(
  onResult: (transcript: string) => void
): VoiceRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);

  // Check if browser supports speech recognition
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true; // Enable continuous listening
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Get the latest result
      const lastResultIndex = event.results.length - 1;
      const result = event.results[lastResultIndex][0].transcript;
      setTranscript(result);
      onResult(result);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignore no-speech errors in continuous mode
      if (event.error === 'no-speech') {
        return;
      }
      
      // For other errors, stop and show message
      setIsListening(false);
      shouldRestartRef.current = false;
      
      switch (event.error) {
        case 'audio-capture':
          setError('Microphone not found');
          break;
        case 'not-allowed':
          setError('Microphone access denied');
          break;
        case 'aborted':
          // User stopped, don't show error
          setError(null);
          break;
        default:
          setError('Error occurred. Try again.');
      }
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't manually stopped
      if (shouldRestartRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            // Ignore if already started
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported, onResult]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setError(null);
      shouldRestartRef.current = true; // Enable auto-restart
      try {
        recognitionRef.current.start();
      } catch (err) {
        setError('Failed to start listening');
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false; // Disable auto-restart
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    transcript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
  };
}
