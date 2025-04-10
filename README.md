# Music Royalty Distribution System

This Solana-based smart contract system automates ownership allocation and royalty distribution for music created collaboratively by humans and AI contributors. The system distributes ownership and royalties according to contribution weights stored in IPFS.

## Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Smart Contract Features](#smart-contract-features)
- [Contribution Data Format](#contribution-data-format)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Building and Deployment](#building-and-deployment)
- [Client Usage](#client-usage)
- [Project Structure](#project-structure)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

The Music Royalty Distribution System implements a fair and transparent way to track contribution weights and distribute royalties proportionally between human and AI creators in music production. This blockchain-based solution ensures:

- Transparent ownership attribution
- Automated royalty distribution
- Immutable record of contributions
- Equitable compensation based on contribution weights

## System Architecture

The system follows this workflow:
1. Human and AI contribution data is collected and stored on IPFS *(Note: IPFS integration is not yet implemented; mock data is currently used)*
2. The client application fetches this contribution data from IPFS *(currently simulated with local mock data)*
3. The client application interacts with the Solana blockchain to register tracks and contributors
4. The smart contract distributes ownership and royalties according to contribution weights
5. Token transfers represent royalty payments to different contributors

![System Architecture Diagram](https://example.com/architecture.png) <!-- You can add a diagram here if available -->

## Smart Contract Features

- **Music Track Initialization**: Create a new on-chain record for a music track with metadata
- **Contributor Management**: Add human and AI contributors with their respective weights
- **Royalty Distribution**: Automatically distribute royalties based on contribution weights
- **Token Creation**: Create SPL tokens to represent royalty payments
- **Account Management**: Handle Solana accounts for contributors and tracks

## Contribution Data Format

The contribution data format (currently used in mock data, with future IPFS storage planned) follows this structure:

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

The `contribution_weight` field is critical as it determines how ownership percentages and royalties are distributed.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.10.0 or higher)
  ```bash
  sh -c "$(curl -sSfL https://release.solana.com/v1.14.18/install)"
  ```

- [Anchor Framework](https://www.anchor-lang.com/docs/installation) (v0.28.0 or higher)
  ```bash
  npm install -g @project-serum/anchor-cli
  ```

- [Node.js](https://nodejs.org/en/download/) (>= 16.0.0)
  ```bash
  # Using nvm (recommended)
  nvm install 16
  nvm use 16
  ```

- [Yarn](https://yarnpkg.com/getting-started/install) (v1.22.0 or higher) or npm
  ```bash
  npm install -g yarn
  ```

- [Rust](https://www.rust-lang.org/tools/install) (for Solana program development)
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- A Solana wallet with some SOL for deployment and testing (on devnet)

## Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/royalty-distribution.git
   cd royalty-distribution
   ```

2. Install JavaScript dependencies
   ```bash
   yarn install
   ```
   
   This will install all the required JavaScript packages listed in `package.json` but will NOT install system-level dependencies like Solana CLI or Anchor Framework.

3. Configure your Solana CLI for devnet
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```

4. Create a wallet for development (if you don't have one)
   ```bash
   solana-keygen new -o keypair.json
   ```

5. Get some SOL for testing
   ```bash
   solana airdrop 2 -k keypair.json
   ```

## Building and Deployment

### Building the Program

```bash
# Build the Solana program
anchor build
```

The build artifacts will be located in the `target/` directory.

### Running Tests

```bash
# Run unit and integration tests
anchor test
```

This will run the test suite defined in the `tests/` directory.

### Deployment

```bash
# Deploy to Solana devnet
anchor deploy --provider.cluster devnet
```

After deployment, the program ID will be displayed. You may need to update the program ID in `Anchor.toml` and redeploy if this is a fresh deployment.

## Client Usage

The project includes two client applications:

### Simple Client

The simple client connects to the program and lists available instructions. This is useful for quick testing and verification of your deployment.

```bash
yarn simple-client
```

or

```bash
./run-client.sh
```

### Full Client with Mock Data

The full client demonstrates the complete workflow using mock data from `app/mock-data.json`. This client simulates a real-world scenario of initializing tracks, adding contributors, and distributing royalties.

**Note: The current implementation uses local mock data rather than IPFS. IPFS integration is planned for future releases.**

```bash
yarn full-client
```

or

```bash
./run-client.sh full
```

#### What the Full Client Does:

1. Displays a list of available tracks from the mock data
2. Prompts you to select a track
3. Initializes a music account on the blockchain
4. Adds the contributors with their respective weights
5. Creates an SPL token for simulating royalty distribution
6. Distributes tokens based on contribution weights
7. Displays the final distribution

## Project Structure

```
royalty-distribution/
├── app/                      # Client applications
│   ├── client.ts             # Full client implementation with mock data
│   ├── simple-client.ts      # Simplified client for testing connection
│   ├── mock-data.json        # Mock music track data (currently used instead of IPFS)
│   └── ipfs-util.ts          # Utilities for IPFS (placeholder for future implementation)
├── programs/                 # Solana program (smart contract) code
│   └── royalty-distribution/ # Main program directory
│       ├── src/              # Source code for the program
│       │   └── lib.rs        # Main program logic
│       └── Cargo.toml        # Rust dependencies
├── migrations/               # Deployment scripts
│   └── deploy.ts             # Deployment logic
├── tests/                    # Test cases
│   └── royalty-distribution.ts # Integration tests
├── Anchor.toml               # Anchor configuration
├── Cargo.toml                # Workspace configuration
├── package.json              # JavaScript dependencies
├── tsconfig.json             # TypeScript configuration
└── run-client.sh             # Convenience script for running clients
```

## Development Guide

### Environment Configuration

Make sure your Solana CLI is configured for devnet:

```bash
solana config set --url https://api.devnet.solana.com
```

Obtain SOL for testing:

```bash
solana airdrop 2
```

### Modifying the Smart Contract

1. Edit the Rust code in `programs/royalty-distribution/src/lib.rs`
2. Build the program:
   ```bash
   anchor build
   ```
3. Update the program ID in `Anchor.toml` if needed
4. Deploy the updated program:
   ```bash
   anchor deploy
   ```

### Modifying the Client

1. Edit the TypeScript files in the `app/` directory
2. Run the client to test your changes:
   ```bash
   yarn client
   ```

### Adding New Features

When adding new features to the smart contract:

1. Define the new instruction in the program
2. Update the client to support the new instruction
3. Add tests for the new functionality
4. Document the changes in the README

### Future Enhancements

The following features are planned for future releases:

1. **IPFS Integration**: Replace local mock data with actual IPFS storage and retrieval
2. **Enhanced Metadata**: Support for more detailed track and contributor metadata
3. **Advanced Royalty Models**: More complex royalty distribution algorithms
4. **UI Dashboard**: A web interface for managing music tracks and monitoring royalty distributions

## Troubleshooting

### Common Issues

- **Build Failures**: Ensure you have the latest versions of Rust and the Solana toolchain
  ```bash
  rustup update
  solana-install update
  ```

- **Deployment Failures**: Make sure you have enough SOL in your wallet
  ```bash
  solana balance
  ```

- **Client Connection Issues**: Verify your network connection and Solana endpoint
  ```bash
  solana config get
  ```

- **Type Checking Errors**: The client applications use the `--transpile-only` flag to bypass TypeScript's type checking due to some compatibility issues with the Anchor types.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

The MIT License is a permissive license that allows you to use, copy, modify, distribute, and sublicense the code for any purpose, including commercial applications, with the only requirement being to include the original copyright notice and permission notice in all copies of the software. 
MIT 