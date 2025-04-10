import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RoyaltyDistribution } from "../target/types/royalty_distribution";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  AuthorityType,
  setAuthority
} from "@solana/spl-token";
import { expect } from "chai";
import { describe, it } from "mocha";

describe("royalty-distribution", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("\n📊 Test Configuration:");
  console.log(`   Provider wallet: ${provider.wallet.publicKey.toString()}`);
  console.log(`   Connection URL: ${provider.connection.rpcEndpoint}`);

  const program = anchor.workspace.RoyaltyDistribution as Program<RoyaltyDistribution>;
  console.log(`   Program ID: ${program.programId.toString()}`);
  
  const musicKeypair = anchor.web3.Keypair.generate();
  console.log(`   Music account: ${musicKeypair.publicKey.toString()}`);
  
  // Create distinct keypairs for both contributors
  const humanContributor = anchor.web3.Keypair.generate();
  console.log(`   Human contributor: ${humanContributor.publicKey.toString()} (40% share)`);
  
  // Create a regular keypair for AI contributor (not a PDA)
  const aiContributor = anchor.web3.Keypair.generate();
  console.log(`   AI contributor: ${aiContributor.publicKey.toString()} (60% share)`);

  let mint: PublicKey;
  let humanTokenAccount: any;
  let aiTokenAccount: any;
  let royaltySource: any;

  // Create a keypair for token operations that we'll use directly
  const tokenKeypair = anchor.web3.Keypair.generate();

  it("Initialize a new music track", async () => {
    console.log("\n🎵 Initializing music track...");
    
    // Fund the token keypair from the provider wallet
    console.log(`   Funding token keypair for transactions...`);
    const fundTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: tokenKeypair.publicKey,
        lamports: 10000000 // 0.01 SOL
      })
    );
    await provider.sendAndConfirm(fundTx);
    console.log(`   ✅ Token keypair funded: ${tokenKeypair.publicKey.toString()}`);
    
    // Initialize music account - no airdrops needed
    const tx = await program.methods
      .initializeMusic("track_001")
      .accounts({
        music: musicKeypair.publicKey,
        authority: provider.wallet.publicKey,
      })
      .signers([musicKeypair])
      .rpc();
    
    console.log(`   ✅ Music track initialized: ${tx}`);
    console.log(`   🔍 Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Fetch the account and check if it was initialized properly
    const musicAccount = await program.account.music.fetch(musicKeypair.publicKey);
    console.log(`   📝 Music ID: ${musicAccount.musicId}`);
    
    expect(musicAccount.musicId).to.equal("track_001");
    expect(musicAccount.contributors.length).to.equal(0);
    expect(musicAccount.totalWeight).to.equal(0);
    expect(musicAccount.initialized).to.equal(true);
  });

  it("Add contributors to the music track", async () => {
    console.log("\n👥 Adding contributors to music track...");
    
    // Add human contributor with 40% weight
    console.log(`   Adding human contributor (40%)...`);
    const humanTx = await program.methods
      .addContribution("Human", 40)
      .accounts({
        music: musicKeypair.publicKey,
        contributor: humanContributor.publicKey,
        authority: provider.wallet.publicKey,
      })
      .rpc();
    
    console.log(`   ✅ Human contributor added: ${humanTx}`);
    console.log(`   🔍 Transaction: https://explorer.solana.com/tx/${humanTx}?cluster=devnet`);

    // Add AI contributor with 60% weight
    console.log(`   Adding AI contributor (60%)...`);
    const aiTx = await program.methods
      .addContribution("AI", 60)
      .accounts({
        music: musicKeypair.publicKey,
        contributor: aiContributor.publicKey,
        authority: provider.wallet.publicKey,
      })
      .rpc();
    
    console.log(`   ✅ AI contributor added: ${aiTx}`);
    console.log(`   🔍 Transaction: https://explorer.solana.com/tx/${aiTx}?cluster=devnet`);

    // Fetch the account and check if contributors were added
    const musicAccount = await program.account.music.fetch(musicKeypair.publicKey);
    console.log(`   📊 Total contributors: ${musicAccount.contributors.length}`);
    console.log(`   📊 Total weight: ${musicAccount.totalWeight}`);
    
    expect(musicAccount.contributors.length).to.equal(2);
    expect(musicAccount.totalWeight).to.equal(100);
    
    // Verify contributor details
    expect(musicAccount.contributors[0].contributorType).to.equal("Human");
    expect(musicAccount.contributors[0].contributionWeight).to.equal(40);
    expect(musicAccount.contributors[0].contributor.toString()).to.equal(humanContributor.publicKey.toString());
    
    expect(musicAccount.contributors[1].contributorType).to.equal("AI");
    expect(musicAccount.contributors[1].contributionWeight).to.equal(60);
    expect(musicAccount.contributors[1].contributor.toString()).to.equal(aiContributor.publicKey.toString());
  });

  it("Create token mint and accounts for royalty distribution", async () => {
    console.log("\n💰 Creating token mint for royalties...");
    
    try {
      // Create a new token mint with tokenKeypair as both payer and authority
      console.log(`   Creating SPL token mint...`);
      mint = await createMint(
        provider.connection,
        tokenKeypair,  // Payer
        tokenKeypair.publicKey,  // Mint authority
        null,
        6
      );
      console.log(`   ✅ Token mint created: ${mint.toString()}`);
  
      // Create token accounts for contributors
      console.log(`   Creating token account for human contributor...`);
      humanTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        tokenKeypair,  // Payer
        mint,
        humanContributor.publicKey
      );
      console.log(`   ✅ Human token account: ${humanTokenAccount.address.toString()}`);
  
      console.log(`   Creating token account for AI contributor...`);
      aiTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        tokenKeypair,  // Payer
        mint,
        aiContributor.publicKey
      );
      console.log(`   ✅ AI token account: ${aiTokenAccount.address.toString()}`);
  
      // Create royalty source account
      console.log(`   Creating royalty source token account...`);
      royaltySource = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        tokenKeypair,  // Payer
        mint,
        provider.wallet.publicKey
      );
      console.log(`   ✅ Royalty source account: ${royaltySource.address.toString()}`);
  
      // Mint 1000 tokens to the royalty source
      console.log(`   Minting 1000 tokens to royalty source...`);
      await mintTo(
        provider.connection,
        tokenKeypair,  // Payer
        mint,
        royaltySource.address,
        tokenKeypair.publicKey,  // Mint authority
        1000000000 // 1000 tokens with 6 decimals
      );
      
      // Now transfer mint authority to the provider wallet
      console.log(`   Transferring mint authority to provider wallet...`);
      await setAuthority(
        provider.connection,
        tokenKeypair, // Payer
        mint,
        tokenKeypair.publicKey, // Current authority
        AuthorityType.MintTokens,
        provider.wallet.publicKey // New authority
      );
  
      // Verify the royalty source has the correct balance
      const tokenInfo = await getAccount(provider.connection, royaltySource.address);
      console.log(`   📊 Royalty source balance: ${parseInt(tokenInfo.amount.toString()) / 1000000} tokens`);
      
      expect(tokenInfo.amount.toString()).to.equal("1000000000");
    } catch (error) {
      console.error("Error in token setup:", error);
      throw error;
    }
  });

  it("Distribute royalties based on contribution weights", async () => {
    console.log("\n💸 Distributing royalties to contributors...");
    
    // Distribute 100 tokens as royalties
    const royaltyAmount = 100000000; // 100 tokens with 6 decimals
    console.log(`   Distributing ${royaltyAmount / 1000000} tokens according to contribution weights...`);
    
    try {
      // Use the distributeRoyalty method with the correct account structure
      // Use type assertion to bypass TypeScript's account property validation
      type DistributeAccounts = {
        music: PublicKey;
        royaltySource: PublicKey;
        authority: PublicKey;
        firstContributor: PublicKey;
        secondContributor: PublicKey;
        tokenProgram: PublicKey;
      };
      
      const distributeTx = await program.methods
        .distributeRoyalty(new anchor.BN(royaltyAmount))
        .accounts({
          music: musicKeypair.publicKey,
          royaltySource: royaltySource.address,
          authority: provider.wallet.publicKey,
          firstContributor: humanTokenAccount.address,
          secondContributor: aiTokenAccount.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as unknown as DistributeAccounts)
        .rpc();
      
      console.log(`   ✅ Royalties distributed: ${distributeTx}`);
      console.log(`   🔍 Transaction: https://explorer.solana.com/tx/${distributeTx}?cluster=devnet`);
  
      // Check human contributor received 40% of royalties
      const humanBalance = await provider.connection.getTokenAccountBalance(humanTokenAccount.address);
      console.log(`   📊 Human contributor balance: ${parseInt(humanBalance.value.amount) / 1000000} tokens (40% of 100)`);
      expect(humanBalance.value.amount).to.equal("40000000"); // 40 tokens
  
      // Check AI contributor received 60% of royalties
      const aiBalance = await provider.connection.getTokenAccountBalance(aiTokenAccount.address);
      console.log(`   📊 AI contributor balance: ${parseInt(aiBalance.value.amount) / 1000000} tokens (60% of 100)`);
      expect(aiBalance.value.amount).to.equal("60000000"); // 60 tokens
  
      // Check royalty source account was debited correctly
      const sourceBalance = await provider.connection.getTokenAccountBalance(royaltySource.address);
      console.log(`   📊 Royalty source remaining balance: ${parseInt(sourceBalance.value.amount) / 1000000} tokens`);
      expect(sourceBalance.value.amount).to.equal("900000000"); // 900 tokens left
      
      console.log("\n✅ All tests passed successfully! ✨");
    } catch (error) {
      console.error("Error in distribution:", error);
      
      // Check the current token balances to debug
      try {
        const sourceBalance = await provider.connection.getTokenAccountBalance(royaltySource.address);
        console.log(`   Source balance: ${sourceBalance.value.amount}`);
      } catch (e) {
        console.log("Could not check source balance");
      }
      
      throw error;
    }
  });
});
