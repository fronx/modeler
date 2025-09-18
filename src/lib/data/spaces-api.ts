export interface Space {
  id: string;
  title: string;
  description: string;
  created: string;
  lastModified: string;
  thoughtCount: number;
  path: string;
}

export interface CreateSpaceRequest {
  title?: string;
  description?: string;
}

export interface UpdateSpaceRequest {
  title?: string;
  description?: string;
}

class SpacesApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'SpacesApiError';
  }
}

export const spacesApi = {
  async getSpaces(): Promise<{ spaces: Space[]; count: number }> {
    try {
      const response = await fetch('/api/spaces');
      if (!response.ok) {
        throw new SpacesApiError(`Failed to fetch spaces: ${response.status}`, response.status);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof SpacesApiError) throw error;
      throw new SpacesApiError('Network error while fetching spaces');
    }
  },

  async createSpace(data: CreateSpaceRequest): Promise<Space> {
    try {
      const response = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title || 'New Space',
          description: data.description || 'A new cognitive modeling space'
        }),
      });

      if (!response.ok) {
        throw new SpacesApiError(`Failed to create space: ${response.status}`, response.status);
      }

      const result = await response.json();
      return result.space;
    } catch (error) {
      if (error instanceof SpacesApiError) throw error;
      throw new SpacesApiError('Network error while creating space');
    }
  },

  async updateSpaceTitle(spaceId: string, title: string): Promise<void> {
    try {
      const response = await fetch(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new SpacesApiError(`Failed to update space title: ${response.status}`, response.status);
      }
    } catch (error) {
      if (error instanceof SpacesApiError) throw error;
      throw new SpacesApiError('Network error while updating space title');
    }
  },

  async updateSpaceDescription(spaceId: string, description: string): Promise<void> {
    try {
      const response = await fetch(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        throw new SpacesApiError(`Failed to update space description: ${response.status}`, response.status);
      }
    } catch (error) {
      if (error instanceof SpacesApiError) throw error;
      throw new SpacesApiError('Network error while updating space description');
    }
  },

  async deleteSpace(spaceId: string): Promise<void> {
    try {
      const response = await fetch(`/api/spaces/${spaceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new SpacesApiError(`Failed to delete space: ${response.status}`, response.status);
      }
    } catch (error) {
      if (error instanceof SpacesApiError) throw error;
      throw new SpacesApiError('Network error while deleting space');
    }
  }
};