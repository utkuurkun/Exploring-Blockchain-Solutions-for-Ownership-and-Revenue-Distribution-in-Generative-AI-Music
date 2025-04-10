use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("3MoZNBwy5WaRDj3E1QZxq4Wub85smJntJSWdtdtcCBzi");

#[program]
pub mod royalty_distribution {
    use super::*;

    pub fn initialize_music(ctx: Context<InitializeMusic>, music_id: String) -> Result<()> {
        let music = &mut ctx.accounts.music;
        music.authority = ctx.accounts.authority.key();
        music.music_id = music_id;
        music.contributors = Vec::new();
        music.total_weight = 0;
        music.initialized = true;
        Ok(())
    }

    pub fn add_contribution(
        ctx: Context<AddContribution>,
        contributor_type: String,
        contribution_weight: u16,
    ) -> Result<()> {
        let music = &mut ctx.accounts.music;
        let contributor = &ctx.accounts.contributor;

        // Check if contributor already exists
        for entry in &music.contributors {
            if entry.contributor == contributor.key() {
                return Err(ErrorCode::ContributorAlreadyExists.into());
            }
        }

        // Add new contributor
        music.contributors.push(ContributorInfo {
            contributor: contributor.key(),
            contributor_type,
            contribution_weight,
        });

        // Update total weight
        music.total_weight = music.total_weight.checked_add(contribution_weight)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn distribute_royalty(
        ctx: Context<DistributeRoyalty>,
        amount: u64,
    ) -> Result<()> {
        // The distribute_royalty logic is now in the implementation
        ctx.accounts.distribute(amount)
    }
}

// Implementation for distribute function
impl<'info> DistributeRoyalty<'info> {
    pub fn distribute(&self, amount: u64) -> Result<()> {
        let music = &self.music;
        
        require!(music.initialized, ErrorCode::MusicNotInitialized);
        require!(music.total_weight > 0, ErrorCode::NoContributors);
        
        // We need at least one contributor
        require!(music.contributors.len() >= 1, ErrorCode::NoContributors);
        
        // Simple case with only one contributor - send all tokens to first contributor
        if music.contributors.len() == 1 {
            let transfer_ctx = CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.royalty_source.to_account_info(),
                    to: self.first_contributor.to_account_info(),
                    authority: self.authority.to_account_info(),
                },
            );
            
            // Transfer all tokens to the single contributor
            token::transfer(transfer_ctx, amount)?;
            return Ok(());
        }
        
        // Two contributors case
        if music.contributors.len() == 2 {
            // Make sure we have the second contributor
            require!(self.second_contributor.is_some(), ErrorCode::InvalidContributors);
            
            let second_contributor = self.second_contributor.as_ref().unwrap();
            
            // Calculate first contributor's share
            let total_weight = music.total_weight as u64;
            let first_weight = music.contributors[0].contribution_weight as u64;
            let first_share = (amount.checked_mul(first_weight)
                .ok_or(ErrorCode::MathOverflow)?)
                .checked_div(total_weight)
                .ok_or(ErrorCode::MathOverflow)?;
            
            // Second contributor gets the remainder
            let second_share = amount.checked_sub(first_share)
                .ok_or(ErrorCode::MathOverflow)?;
            
            // Transfer to first contributor
            if first_share > 0 {
                let transfer_ctx = CpiContext::new(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: self.royalty_source.to_account_info(),
                        to: self.first_contributor.to_account_info(),
                        authority: self.authority.to_account_info(),
                    },
                );
                token::transfer(transfer_ctx, first_share)?;
            }
            
            // Transfer to second contributor
            if second_share > 0 {
                let transfer_ctx = CpiContext::new(
                    self.token_program.to_account_info(),
                    Transfer {
                        from: self.royalty_source.to_account_info(),
                        to: second_contributor.to_account_info(),
                        authority: self.authority.to_account_info(),
                    },
                );
                token::transfer(transfer_ctx, second_share)?;
            }
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMusic<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 100 + 4 + (32 + 20 + 2) * 10 + 2 + 1
    )]
    pub music: Account<'info, Music>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddContribution<'info> {
    #[account(mut)]
    pub music: Account<'info, Music>,
    /// CHECK: This account is used to store the contributor's pubkey
    pub contributor: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DistributeRoyalty<'info> {
    #[account(
        constraint = music.authority == authority.key()
    )]
    pub music: Account<'info, Music>,
    
    /// CHECK: This is the token account for royalty source
    #[account(mut)]
    pub royalty_source: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    
    /// CHECK: This is the first contributor's token account
    #[account(mut)]
    pub first_contributor: AccountInfo<'info>,
    
    /// CHECK: This is the second contributor's token account (optional)
    #[account(mut)]
    pub second_contributor: Option<AccountInfo<'info>>,
}

#[account]
pub struct Music {
    pub authority: Pubkey,
    pub music_id: String,
    pub contributors: Vec<ContributorInfo>,
    pub total_weight: u16,
    pub initialized: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ContributorInfo {
    pub contributor: Pubkey,
    pub contributor_type: String,
    pub contribution_weight: u16,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Contributor already exists")]
    ContributorAlreadyExists,
    #[msg("Music not initialized")]
    MusicNotInitialized,
    #[msg("No contributors")]
    NoContributors,
    #[msg("Mismatch between contributor metadata and passed accounts")]
    InvalidContributors,
}
