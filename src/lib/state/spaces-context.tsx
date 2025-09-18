'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Space, spacesApi, CreateSpaceRequest } from '../data/spaces-api';

interface SpacesContextType {
  spaces: Space[];
  currentSpaceId: string | null;
  setSpaces: (spaces: Space[]) => void;
  setCurrentSpaceId: (spaceId: string | null) => void;
  createSpace: (data: CreateSpaceRequest) => Promise<Space>;
  updateSpaceTitle: (spaceId: string, title: string) => Promise<void>;
  updateSpaceDescription: (spaceId: string, description: string) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  refreshSpaces: () => Promise<void>;
}

const SpacesContext = createContext<SpacesContextType | undefined>(undefined);

interface SpacesProviderProps {
  children: ReactNode;
}

export const SpacesProvider: React.FC<SpacesProviderProps> = ({ children }) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);

  const refreshSpaces = useCallback(async () => {
    try {
      const { spaces: fetchedSpaces } = await spacesApi.getSpaces();
      setSpaces(fetchedSpaces);
    } catch (error) {
      console.error('Failed to refresh spaces:', error);
      throw error;
    }
  }, []);

  const createSpace = useCallback(async (data: CreateSpaceRequest): Promise<Space> => {
    try {
      const newSpace = await spacesApi.createSpace(data);

      // Add to local state
      setSpaces(currentSpaces => [newSpace, ...currentSpaces]);

      // Note: Auto-selection is handled by the CognitiveDataProvider
      // which has access to both spaces and thoughts contexts

      return newSpace;
    } catch (error) {
      console.error('Failed to create space:', error);
      throw error;
    }
  }, []);

  const updateSpaceTitle = useCallback(async (spaceId: string, title: string): Promise<void> => {
    try {
      await spacesApi.updateSpaceTitle(spaceId, title);

      // Update local state
      setSpaces(currentSpaces =>
        currentSpaces.map(space =>
          space.id === spaceId
            ? { ...space, title, lastModified: new Date().toISOString() }
            : space
        )
      );
    } catch (error) {
      console.error('Failed to update space title:', error);
      throw error;
    }
  }, []);

  const updateSpaceDescription = useCallback(async (spaceId: string, description: string): Promise<void> => {
    try {
      await spacesApi.updateSpaceDescription(spaceId, description);

      // Update local state
      setSpaces(currentSpaces =>
        currentSpaces.map(space =>
          space.id === spaceId
            ? { ...space, description, lastModified: new Date().toISOString() }
            : space
        )
      );
    } catch (error) {
      console.error('Failed to update space description:', error);
      throw error;
    }
  }, []);

  const deleteSpace = useCallback(async (spaceId: string): Promise<void> => {
    try {
      await spacesApi.deleteSpace(spaceId);

      // Update local state
      setSpaces(currentSpaces => currentSpaces.filter(space => space.id !== spaceId));

      // Clear current space if it was deleted
      if (currentSpaceId === spaceId) {
        setCurrentSpaceId(null);
      }
    } catch (error) {
      console.error('Failed to delete space:', error);
      throw error;
    }
  }, [currentSpaceId]);

  const value: SpacesContextType = {
    spaces,
    currentSpaceId,
    setSpaces,
    setCurrentSpaceId,
    createSpace,
    updateSpaceTitle,
    updateSpaceDescription,
    deleteSpace,
    refreshSpaces,
  };

  return (
    <SpacesContext.Provider value={value}>
      {children}
    </SpacesContext.Provider>
  );
};

export const useSpaces = (): SpacesContextType => {
  const context = useContext(SpacesContext);
  if (context === undefined) {
    throw new Error('useSpaces must be used within a SpacesProvider');
  }
  return context;
};