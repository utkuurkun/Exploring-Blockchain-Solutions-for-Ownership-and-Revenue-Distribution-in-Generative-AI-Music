# Music Royalty Distribution System

This Solana-based smart contract system automates ownership allocation and royalty distribution for music created collaboratively by humans and AI contributors. The system distributes ownership and royalties according to contribution weights stored in IPFS.

## System Architecture

The system follows this workflow:
1. Human and AI contribution data is collected and stored on IPFS
2. The client application fetches this contribution data from IPFS
3. The client sends the relevant information to the Solana smart contract
4. The smart contract distributes ownership and royalties according to contribution weights

## Smart Contract Features

- **Music Track Initialization**: Create a new on-chain record for a music track
- **Contributor Management**: Add human and AI contributors with their respective weights
- **Royalty Distribution**: Automatically distribute royalties based on contribution weights

## Contribution Data Format

The contribution data stored on IPFS follows this structure:

```json
{
    "music_id": "track_001",
    "contributions": [
        {
            "contributor_type": "Human",
            "prompts": 5,
            "refinements": 8,
            "time_spent_minutes": 120,
            "contribution_weight": 40
        },
        {
            "contributor_type": "AI",
            "iterations": 50,
            "complexity_score": "High",
            "contribution_weight": 60
        }
    ],
    "generation_date": "2025-03-21T15:30:00Z"
}
```

The `contribution_weight` field determines how ownership and royalties are distributed.

## Development Setup

### Prerequisites
- Solana Tool Suite
- Anchor Framework
- Node.js and npm/yarn

### Building
```bash
# Build the Solana program
anchor build

# Run tests
anchor test
```

### Deployment
```bash
# Deploy to Solana devnet
anchor deploy --provider.cluster devnet
```

## Usage

1. Store contribution data on IPFS
2. Initialize a music track on-chain
3. Add contributors with their contribution weights
4. Set up token accounts for royalty distribution
5. Distribute royalties based on contribution weights

## License

This project is licensed under the MIT License - see the LICENSE file for details.

# Royalty Distribution System

This project implements a royalty distribution system for music creators using the Solana blockchain. It allows for tracking contribution weights of both human and AI creators, and distributing royalties proportionally based on these weights.

## Prerequisites

- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor Framework](https://www.anchor-lang.com/docs/installation)
- [Node.js](https://nodejs.org/en/download/) (>= 16.0.0)
- [Yarn](https://yarnpkg.com/getting-started/install) or npm

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   yarn install
   ```
3. Build the Solana program:
   ```
   anchor build
   ```
4. Deploy the program to the Solana devnet:
   ```
   anchor deploy --provider.cluster devnet
   ```

## Client Usage

The project includes two client applications:

1. **Simple Client**: Connects to the program and lists available instructions
2. **Full Client**: Demonstrates the complete workflow with mock data

### Running the Simple Client

```
yarn simple-client
```

or

```
./run-client.sh
```

### Running the Full Client with Mock Data

The full client uses a mock data file (`app/mock-data.json`) that contains information about multiple music tracks. When you run the full client, you will be prompted to select a track from the available options.

```
yarn full-client
```

or

```
./run-client.sh full
```

This will:
1. Display a list of available tracks from the mock data
2. Prompt you to select a track
3. Initialize a music account on the blockchain
4. Add the contributors with their respective weights
5. Create a token for simulating royalty distribution
6. Distribute tokens based on contribution weights
7. Display the final distribution

## Developing

### Environment Configuration

Make sure your Solana CLI is configured for devnet:

```
solana config set --url https://api.devnet.solana.com
```

Obtain some SOL for testing:

```
solana airdrop 2
```

### Project Structure

- `programs/royalty-distribution/`: Solana program (smart contract) code
- `app/`: Client applications
  - `client.ts`: Full client implementation with mock data
  - `simple-client.ts`: Simplified client for testing connection
  - `mock-data.json`: Mock music track data
  - `ipfs-util.ts`: Utilities for IPFS (to be implemented in the future)
- `tests/`: Test cases

## Note on Type Checking

The client applications use the `--transpile-only` flag to bypass TypeScript's type checking due to some compatibility issues with the Anchor types. This allows the client to run despite type errors.

## License

MIT 