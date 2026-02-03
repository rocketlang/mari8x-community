import { gql, useQuery } from '@apollo/client';

const GET_VESSELS = gql`
  query GetVessels {
    vessels(take: 10) {
      imo
      name
      type
      flag
    }
  }
`;

export default function App() {
  const { data, loading, error } = useQuery(GET_VESSELS);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🚢 Mari8X Community Edition</h1>
      <p>Open source maritime vessel tracking</p>

      <h2>Recent Vessels</h2>
      {loading && <p>Loading vessels...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && (
        <ul>
          {data.vessels.map((vessel: any) => (
            <li key={vessel.imo}>
              <strong>{vessel.name}</strong> ({vessel.imo}) - {vessel.type} - {vessel.flag}
            </li>
          ))}
        </ul>
      )}

      <footer style={{ marginTop: '2rem', color: '#666' }}>
        <p>
          Powered by <a href="https://aisstream.io">AISstream.io</a> (free tier)
        </p>
        <p>
          <a href="/graphql">GraphQL Playground</a> | 
          <a href="https://github.com/your-org/mari8x-community">GitHub</a>
        </p>
      </footer>
    </div>
  );
}
