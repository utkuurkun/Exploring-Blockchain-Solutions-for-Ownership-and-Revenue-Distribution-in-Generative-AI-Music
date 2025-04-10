import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  createAccount
} from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

// Define program ID (must match the ID in Anchor.toml)
const PROGRAM_ID_STR = "3MoZNBwy5WaRDj3E1QZxq4Wub85smJntJSWdtdtcCBzi";
const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);
const DEVNET_URL = "https://api.devnet.solana.com";

// Flag to enable mock mode (simulates blockchain operations)
const MOCK_MODE = false;

// Define types for our mock data
interface Contribution {
  contributor_type: string;
  description: string;
  prompts?: number;
  refinements?: number;
  time_spent_minutes?: number;
  iterations?: number;
  complexity_score?: string;
  contribution_weight: number;
  wallet_address: string;
}

interface Track {
  music_id: string;
  title: string;
  contributions: Contribution[];
  generation_date: string;
}

interface MockData {
  tracks: Track[];
}

// Helper to get a keypair from the project's keypair.json file
function getKeypair(): Keypair {
  try {
    // Use the keypair.json file in the project root
    const keypairPath = path.join(__dirname, '../keypair.json');
    if (fs.existsSync(keypairPath)) {
      const secretKey = Buffer.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')));
      return Keypair.fromSecretKey(secretKey);
    }
    
    // Fall back to the Solana CLI config as a backup
    const configFile = path.join(os.homedir(), '.config', 'solana', 'id.json');
    if (fs.existsSync(configFile)) {
      const secretKey = Buffer.from(JSON.parse(fs.readFileSync(configFile, 'utf-8')));
      return Keypair.fromSecretKey(secretKey);
    }
  } catch (err) {
    console.log('Could not get keypair, generating new keypair:', err);
  }
  
  // Generate new keypair if none exists
  return Keypair.generate();
}

// Load mock data from JSON file
function loadMockData(): MockData {
  const mockDataPath = path.join(__dirname, 'mock-data.json');
  try {
    const data = fs.readFileSync(mockDataPath, 'utf8');
    return JSON.parse(data) as MockData;
  } catch (err) {
    console.error('Failed to load mock data:', err);
    process.exit(1);
  }
}

// Create a readline interface for user input
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Prompt user to select a track
async function selectTrack(tracks: Track[]): Promise<Track> {
  return new Promise((resolve) => {
    const rl = createInterface();
    
    console.log('\nAvailable tracks:');
    tracks.forEach((track, index) => {
      console.log(`${index + 1}. ${track.title} (ID: ${track.music_id})`);
    });
    
    rl.question('\nSelect a track number: ', (answer) => {
      rl.close();
      const trackIndex = parseInt(answer) - 1;
      
      if (isNaN(trackIndex) || trackIndex < 0 || trackIndex >= tracks.length) {
        console.log(`Invalid selection. Using default track (1).`);
        resolve(tracks[0]);
      } else {
        resolve(tracks[trackIndex]);
      }
    });
  });
}

// Simulated program methods for mock mode
class MockProgram {
  async initializeMusic(musicId: string, accounts: any, signers: any[]): Promise<string> {
    console.log('[MOCK] Initialized music with ID:', musicId);
    return 'mock-transaction-signature';
  }
  
  async addContribution(contributorType: string, weight: number, accounts: any): Promise<string> {
    console.log(`[MOCK] Added ${contributorType} contributor with weight ${weight}`);
    return 'mock-transaction-signature';
  }
  
  async distributeRoyalty(amount: any, accounts: any): Promise<string> {
    console.log(`[MOCK] Distributed ${amount} tokens as royalties`);
    return 'mock-transaction-signature';
  }
}

// Mock token operations
async function mockCreateMint(): Promise<PublicKey> {
  console.log('[MOCK] Created token mint');
  return Keypair.generate().publicKey;
}

async function mockGetOrCreateAssociatedTokenAccount(mint: PublicKey, owner: PublicKey): Promise<any> {
  console.log(`[MOCK] Created token account for ${owner.toString().slice(0, 8)}...`);
  return {
    address: Keypair.generate().publicKey,
    amount: 0
  };
}

async function mockMintTo(destination: PublicKey, amount: number): Promise<void> {
  console.log(`[MOCK] Minted ${amount / 1000000} tokens to ${destination.toString().slice(0, 8)}...`);
}

async function mockGetAccount(address: PublicKey): Promise<any> {
  // Simulate token balances based on the address
  // We'll use the last 4 digits of the address to generate a random-ish but deterministic balance
  const addressStr = address.toString();
  const lastFourChars = addressStr.slice(addressStr.length - 4);
  const randomBalance = parseInt(lastFourChars, 16) % 1000; // Convert to number between 0-999
  
  return {
    address,
    amount: randomBalance * 1000000, // Convert to token amount with decimals
    owner: Keypair.generate().publicKey
  };
}

// Add a helper function for handling rate limiting and retries
async function executeWithRetry(operation: () => Promise<any>, maxRetries = 3, delay = 1000): Promise<any> {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const isRateLimit = err instanceof Error && 
        (err.message.includes('429') || 
         err.message.includes('too many requests') ||
         err.message.includes('rate limit'));
         
      if (isRateLimit) {
        console.log(`Rate limit hit, retrying in ${delay/1000} seconds (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next retry (exponential backoff)
        delay = delay * 2;
      } else {
        // If it's not a rate limit error, don't retry
        throw err;
      }
    }
  }
  throw lastError;
}

async function main() {
  try {
    // Track transaction fees
    let totalFees = 0;
    const trackTransaction = async (signature: string, operation: string) => {
      if (MOCK_MODE) return; // Skip in mock mode
      
      try {
        // Wait for transaction confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        
        // Get transaction details
        const transaction = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        if (transaction && transaction.meta) {
          const fee = transaction.meta.fee / 1_000_000_000; // Convert lamports to SOL
          totalFees += fee;
          console.log(`📊 Transaction Fee: ${fee.toFixed(9)} SOL (${operation})`);
          console.log(`🔍 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        }
      } catch (err) {
        console.error(`Could not fetch transaction fee for ${operation}`);
      }
    };

    // Load mock data
    const mockData = loadMockData();
    console.log(`Loaded ${mockData.tracks.length} tracks from mock data`);
    
    // Select a track
    const selectedTrack = await selectTrack(mockData.tracks);
    console.log(`Selected track: ${selectedTrack.title} (${selectedTrack.music_id})`);
    
    // Set up connection and wallet for fee payer
    const connection = new Connection(process.env.ANCHOR_PROVIDER_URL || DEVNET_URL);
    const feePayerWallet = getKeypair();
    console.log('Using fee payer wallet:', feePayerWallet.publicKey.toString());
    
    // Create separate wallets for contributors
    const humanWallet = Keypair.generate();
    const aiWallet = Keypair.generate();
    console.log('Contributor wallets:');
    console.log(`- 👤 Human: ${humanWallet.publicKey.toString()}`);
    console.log(`- 🤖 AI: ${aiWallet.publicKey.toString()}`);
    
    // Check if fee payer wallet has funds
    let balance = 0;
    try {
      balance = await connection.getBalance(feePayerWallet.publicKey);
      console.log('Fee payer balance:', balance / 1_000_000_000, 'SOL');
      
      if (balance < 1_000_000_000) {
        console.warn('Warning: Fee payer wallet balance is low, some operations might fail');
        console.log('You can fund your wallet using: solana airdrop 2');
        
        if (!MOCK_MODE) {
          console.log('To continue without real blockchain operations, set MOCK_MODE to true');
        }
      }
    } catch (err) {
      console.warn('Could not check wallet balance. Network may be unavailable.');
      if (!MOCK_MODE) {
        console.log('To continue without real blockchain operations, set MOCK_MODE to true');
        return;
      }
    }
    
    // Set up Provider manually with rate limiting retry options
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(feePayerWallet),
      { 
        commitment: 'confirmed',
        // Add options to handle rate limiting
        skipPreflight: true, // Skip preflight to avoid some rate limit issues
        preflightCommitment: 'processed',
      }
    );
    anchor.setProvider(provider);
    
    // Initialize program
    let program: any;
    let usingMockProgram = false;
    
    if (!MOCK_MODE) {
      try {
        // Try to load the IDL file
        const idlPath = path.join(__dirname, '../target/idl/royalty_distribution.json');
        const idlFile = fs.readFileSync(idlPath, 'utf8');
        const idl = JSON.parse(idlFile);
        console.log('IDL loaded successfully');
        
        // Create program with IDL
        program = new anchor.Program(idl, provider);
        console.log('Program initialized with IDL file');
      } catch (err) {
        console.error('Failed to load IDL from file:', err);
        
        // Try to fetch IDL from the chain as a fallback
        console.log('Attempting to fetch IDL from chain...');
        try {
          const fetchedIdl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
          
          if (fetchedIdl) {
            console.log('IDL fetched from chain successfully');
            program = new anchor.Program(fetchedIdl, provider);
            console.log('Program initialized with chain IDL');
          } else {
            console.error('No IDL found on chain');
            if (MOCK_MODE) {
              usingMockProgram = true;
              program = new MockProgram();
              console.log('Using mock program for demonstration');
            } else {
              throw new Error('Failed to initialize program: No IDL available');
            }
          }
        } catch (fetchErr) {
          console.error('Failed to fetch IDL from chain:', fetchErr);
          throw new Error('Failed to initialize program: Could not load IDL');
        }
      }
    } else {
      usingMockProgram = true;
      program = new MockProgram();
      console.log('Using mock program for demonstration');
    }
    
    // Update wallet addresses in the contributions data
    const contributionData: Track = JSON.parse(JSON.stringify(selectedTrack)); // Deep clone
    
    // Replace placeholder wallet addresses with our custom wallets
    contributionData.contributions.forEach(contribution => {
      if (contribution.contributor_type === "Human") {
        contribution.wallet_address = humanWallet.publicKey.toString();
      } else if (contribution.contributor_type === "AI") {
        contribution.wallet_address = aiWallet.publicKey.toString();
      }
    });
    
    // Log simplified contribution data
    console.log('\nContribution weights:');
    contributionData.contributions.forEach(contribution => {
      console.log(`- ${contribution.contributor_type}: ${contribution.contribution_weight}%`);
    });

    // Initialize music account on-chain
    console.log('\n🎵 Initializing music account...');
    const music = anchor.web3.Keypair.generate();
    
    try {
      let signature;
      if (usingMockProgram) {
        signature = await (program as MockProgram).initializeMusic(
          contributionData.music_id,
          { music: music.publicKey, authority: feePayerWallet.publicKey },
          [music]
        );
      } else {
        // Use retry mechanism for rate limiting
        signature = await executeWithRetry(async () => {
          return program.methods
            .initializeMusic(contributionData.music_id)
            .accounts({
              music: music.publicKey,
              authority: feePayerWallet.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([music])
            .rpc();
        });
          
        // Track the transaction fee
        await trackTransaction(signature, 'Initialize Music');
      }
      
      console.log('✅ Music initialized with ID:', contributionData.music_id);
      console.log('📝 Music account address:', music.publicKey.toString());
    } catch (err) {
      console.error('Error initializing music:', err);
      if (!MOCK_MODE) return;
    }
    
    // Add contributions to the music track
    console.log('\n👥 Adding contributors to music track...');
    
    for (const contribution of contributionData.contributions) {
      try {
        const weight = parseInt(contribution.contribution_weight.toString());
        const contributorAddress = new PublicKey(contribution.wallet_address);
        
        let signature;
        if (usingMockProgram) {
          signature = await (program as MockProgram).addContribution(
            contribution.contributor_type,
            weight,
            {
              music: music.publicKey,
              contributor: contributorAddress,
              authority: feePayerWallet.publicKey,
            }
          );
        } else {
          // Use retry mechanism for rate limiting
          signature = await executeWithRetry(async () => {
            return program.methods
              .addContribution(
                contribution.contributor_type,
                weight
              )
              .accounts({
                music: music.publicKey,
                contributor: contributorAddress,
                authority: feePayerWallet.publicKey,
              })
              .rpc();
          });
            
          // Track the transaction fee
          await trackTransaction(signature, `Add ${contribution.contributor_type} Contributor`);
        }
        
        console.log(`✅ Added contributor ${contributorAddress.toString()} with weight ${weight}`);
      } catch (err) {
        console.error(`Error adding contributor:`, err);
        if (!MOCK_MODE) return;
      }
    }
    
    // Create a token mint for royalty distribution (simulating royalties)
    console.log('\n💰 Creating royalty token...');
    let mint;
    try {
      if (MOCK_MODE) {
        mint = await mockCreateMint();
      } else {
        mint = await executeWithRetry(async () => {
          return createMint(
            connection,
            feePayerWallet,
            feePayerWallet.publicKey,
            null,
            6 // 6 decimals
          );
        });
      }
      console.log('Created mint:', mint.toString());
    } catch (err) {
      console.error('Error creating mint:', err);
      if (!MOCK_MODE) return;
      
      // Fallback to mock mint in case of error
      mint = Keypair.generate().publicKey;
      console.log('[MOCK] Created fallback mint:', mint.toString());
    }
    
    // Create token accounts for the contributors and mint tokens to the source account
    console.log('\n📦 Setting up token accounts...');
    const contributorTokenAccounts = [];
    let royaltySource;
    
    try {
      if (MOCK_MODE) {
        royaltySource = await mockGetOrCreateAssociatedTokenAccount(mint, feePayerWallet.publicKey);
        await mockMintTo(royaltySource.address, 10000 * 1000000);
      } else {
        try {
          // Create a token account owned by the fee payer wallet for the royalty source
          // This is critical - the fee payer must be the owner to authorize transfers
          console.log("Creating royalty source token account...");
          royaltySource = await executeWithRetry(async () => {
            return getOrCreateAssociatedTokenAccount(
              connection,
              feePayerWallet,  // Fee payer
              mint,
              feePayerWallet.publicKey  // Owner must be the fee payer wallet to authorize transfers
            );
          });
          
          // Mint some tokens to the royalty source (10,000 tokens)
          console.log("Minting tokens to royalty source...");
          await executeWithRetry(async () => {
            return mintTo(
              connection,
              feePayerWallet,
              mint,
              royaltySource.address,
              feePayerWallet.publicKey,
              10000 * 1000000 // Amount with decimals
            );
          });
          console.log("Mint successful");
        } catch (innerErr) {
          console.error("Error creating royalty source:", innerErr.message);
          throw innerErr; // Re-throw to be caught by outer catch
        }
      }
      
      console.log('Royalty source account:', royaltySource.address.toString());
      console.log('Minted 10,000 tokens to source');
    } catch (err) {
      console.error('Error setting up royalty source:', err);
      if (!MOCK_MODE) return;
      
      // Fallback to mock royalty source
      royaltySource = {
        address: Keypair.generate().publicKey,
        amount: 10000 * 1000000
      };
      console.log('[MOCK] Created fallback royalty source:', royaltySource.address.toString());
    }
    
    // Create token accounts for each contributor
    try {
      for (const contribution of contributionData.contributions) {
        const contributorAddress = new PublicKey(contribution.wallet_address);
        let tokenAccount;
        
        if (MOCK_MODE) {
          tokenAccount = await mockGetOrCreateAssociatedTokenAccount(mint, contributorAddress);
        } else {
          tokenAccount = await executeWithRetry(async () => {
            return getOrCreateAssociatedTokenAccount(
              connection,
              feePayerWallet,
              mint,
              contributorAddress
            );
          });
        }
        
        contributorTokenAccounts.push(tokenAccount);
        console.log(`Created token account for ${contribution.contributor_type}: ${tokenAccount.address.toString()}`);
      }
    } catch (err) {
      console.error('Error creating contributor token accounts:', err);
      if (!MOCK_MODE) return;
      
      // Create mock token accounts as fallback
      contributionData.contributions.forEach(contribution => {
        const contributorAddress = new PublicKey(contribution.wallet_address);
        const tokenAccount = {
          address: Keypair.generate().publicKey,
          amount: 0
        };
        contributorTokenAccounts.push(tokenAccount);
        console.log(`[MOCK] Created fallback token account for ${contribution.contributor_type}: ${tokenAccount.address.toString()}`);
      });
    }
    
    // Distribute royalties based on contribution weights
    console.log('\n💰 Distributing royalties...');
    
    const royaltyAmount = 1000 * 1000000; // 1,000 tokens with decimals

    console.log('\n💰 Royalty amount:', royaltyAmount / 1000000);
    
    try {
      // Use optional second contributor if available
      const secondContributor = contributorTokenAccounts.length > 1 ? 
        contributorTokenAccounts[1].address : 
        null;

      console.log("\nDistribution details:");
      console.log(`- Music account: ${music.publicKey.toString()}`);
      console.log(`- Royalty source: ${royaltySource.address.toString()}`);
      console.log(`- Source owner: ${feePayerWallet.publicKey.toString()}`);
      console.log(`- First contributor (${contributionData.contributions[0].contributor_type}): ${contributorTokenAccounts[0].address.toString()}`);
      if (secondContributor) {
        console.log(`- Second contributor (${contributionData.contributions[1].contributor_type}): ${secondContributor.toString()}`);
      } else {
        console.log('- Second contributor: None');
      }
      
      // Check royalty source token balance before distribution
      if (!MOCK_MODE) {
        try {
          const sourceInfo = await getAccount(connection, royaltySource.address);
          console.log(`Source token balance: ${Number(sourceInfo.amount) / 1000000} tokens`);
          console.log(`Source token owner: ${sourceInfo.owner.toString()}`);
        } catch (err) {
          console.error("Failed to get source token info:", err.message);
        }
      }
      
      let signature;
      if (usingMockProgram) {
        signature = await (program as MockProgram).distributeRoyalty(
          royaltyAmount,
          {
            music: music.publicKey,
            royaltySource: royaltySource.address,
            authority: feePayerWallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            firstContributor: contributorTokenAccounts[0].address,
            secondContributor: secondContributor,
          }
        );
      } else {
        // Add a small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try direct RPC call first (simpler approach)
        try {
          console.log("Sending distribute transaction with direct RPC call...");
          
          // For a single contributor case
          if (!secondContributor) {
            signature = await program.methods
              .distributeRoyalty(new anchor.BN(royaltyAmount))
              .accounts({
                music: music.publicKey,
                royaltySource: royaltySource.address,
                authority: feePayerWallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                firstContributor: contributorTokenAccounts[0].address,
              })
              .rpc();
          } 
          // For two contributors
          else {
            signature = await program.methods
              .distributeRoyalty(new anchor.BN(royaltyAmount))
              .accounts({
                music: music.publicKey,
                royaltySource: royaltySource.address,
                authority: feePayerWallet.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                firstContributor: contributorTokenAccounts[0].address,
                secondContributor: secondContributor,
              })
              .rpc();
          }
          
          console.log("Direct RPC call succeeded with signature:", signature);
        } catch (directErr) {
          console.log("Direct RPC call failed, attempting manual transaction construction...");
          console.error("Original error:", directErr.message);
          
          // Fallback to manual transaction construction
          // Create a transaction for distributing royalties
          const ix = await program.methods
            .distributeRoyalty(new anchor.BN(royaltyAmount))
            .accounts({
              music: music.publicKey,
              royaltySource: royaltySource.address,
              authority: feePayerWallet.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              firstContributor: contributorTokenAccounts[0].address,
              // Only include secondContributor if it exists
              ...(secondContributor ? { secondContributor } : {})
            })
            .instruction();
            
          // Create a new transaction with just this instruction
          const tx = new anchor.web3.Transaction().add(ix);
          
          // Sign and send the transaction
          signature = await anchor.web3.sendAndConfirmTransaction(
            connection,
            tx,
            [feePayerWallet]
          );
          console.log("Manual transaction construction succeeded with signature:", signature);
        }
        
        // Track the transaction fee
        await trackTransaction(signature, 'Distribute Royalties');
      }
      
      console.log('✅ Royalties distributed successfully!');
    } catch (err) {
        console.error('Error distributing royalties:', err);
        console.error('Detailed error message:', err.message);
        if (!MOCK_MODE) return;
    }
    
    // Check balances to verify distribution
    console.log('\n📊 Verifying token balances...');
    
    try {
      // Calculate expected distribution
      const weights = contributionData.contributions.map(c => 
        parseInt(c.contribution_weight.toString())
      );
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      
      // Calculate expected amounts
      const expectedAmounts = weights.map(weight => {
        return Math.floor((weight / totalWeight) * royaltyAmount);
      });
      
      // Add a delay to allow the blockchain to update
      if (!MOCK_MODE) {
        console.log("Waiting for transaction confirmation and finality...");
        await new Promise(resolve => setTimeout(resolve, 8000));  // Increased to 8 seconds
      }
      
      console.log('\nContributor Token Balances:');
      for (let i = 0; i < contributorTokenAccounts.length; i++) {
        let info;
        try {
          if (MOCK_MODE) {
            // In mock mode, use the expected amounts to simulate balances
            info = {
              amount: expectedAmounts[i]
            };
          } else {
            // Refresh account info from the blockchain with max commitment
            info = await getAccount(
              connection, 
              contributorTokenAccounts[i].address, 
              'confirmed'
            );
          }
          
          const balance = Number(info.amount) / 1000000;
          console.log(`Contributor ${i+1} (${contributionData.contributions[i].contributor_type}): ${balance} tokens`);
          console.log(`Expected: ${expectedAmounts[i] / 1000000} tokens`);
          
          // Verify if actual matches expected
          if (Math.abs(balance - expectedAmounts[i] / 1000000) < 0.001) {
            console.log(`✅ Distribution correct`);
          } else {
            console.log(`⚠️ Distribution differs from expected amount`);
          }
        } catch (err) {
          console.error(`Error fetching balance for contributor ${i+1}:`, err);
          console.log(`Expected balance for contributor ${i+1}: ${expectedAmounts[i] / 1000000} tokens`);
        }
      }
      
      console.log('\nDistribution Summary:');
      contributionData.contributions.forEach((contribution, i) => {
        const weight = parseInt(contribution.contribution_weight.toString());
        console.log(`- ${contribution.contributor_type}: ${weight / totalWeight * 100}% (${expectedAmounts[i] / 1000000} tokens)`);
      });
      
      console.log('\n✅ Royalty distribution completed successfully!');
      
      // Show total transaction fees if not in mock mode
      if (!MOCK_MODE) {
        console.log(`\n💵 Total Transaction Fees: ${totalFees.toFixed(9)} SOL`);
        console.log(`\nView the account activity on Solana Explorer:`);
        console.log(`https://explorer.solana.com/address/${feePayerWallet.publicKey.toString()}?cluster=devnet`);
      }
    } catch (err) {
      console.error('Error verifying balances:', err);
    }
    
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
  }
}

main().then(
  () => process.exit(0),
  err => {
    console.error(err);
    process.exit(1);
  }
); 