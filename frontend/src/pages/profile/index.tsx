import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Card, Container, Text, Input, Alert } from '@mantine/core';

interface TokenResponse {
  token: string;
}

export default function ProfilePage() {
  const [apiToken, setApiToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch the current token on page load
  useEffect(() => {
    fetchToken();
  }, []);

  const fetchToken = async () => {
    try {
      setLoading(true);
      const response = await axios.get<TokenResponse>('/api/api-token/');
      setApiToken(response.data.token);
    } catch (err) {
      setError('Failed to fetch API token');
    } finally {
      setLoading(false);
    }
  };

  const updateToken = async (newToken: string) => {
    try {
      setLoading(true);
      setError(null);
      await axios.post('/api/api-token/', { token: newToken });
      setApiToken(newToken);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to update API token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Card shadow="sm" p="lg">
        <Text size="xl" mb="md">
          API Token Management
        </Text>

        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        {success && (
          <Alert color="green" mb="md">
            Token successfully updated!
          </Alert>
        )}

        <Input.Wrapper label="Your API Token" mb="md">
          <Input
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            rightSection={
              <Button
                variant="light"
                size="xs"
                onClick={() => navigator.clipboard.writeText(apiToken)}
              >
                Copy
              </Button>
            }
          />
        </Input.Wrapper>

        <Button
          onClick={() => updateToken(apiToken)}
          loading={loading}
          color="blue"
          fullWidth
        >
          Update Token
        </Button>
      </Card>
    </Container>
  );
}
