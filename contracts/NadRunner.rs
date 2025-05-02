use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    program_pack::{IsInitialized, Pack, Sealed},
    sysvar::{rent::Rent, Sysvar, clock::Clock},
    secp256k1_recover::{secp256k1_recover, Secp256k1RecoverError},
    keccak::hash,
};
use std::convert::TryInto;

// Define the structure of our token account data
#[derive(Clone, Debug, Default, PartialEq)]
pub struct NadrunnerToken {
    pub is_initialized: bool,
    pub owner: Pubkey,
    pub amount: u64,
}

// Define the structure of our mint authority data
#[derive(Clone, Debug, Default, PartialEq)]
pub struct MintAuthority {
    pub is_initialized: bool,
    pub signer_pubkey: Pubkey,
}

// Define program-specific errors
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum NadrunnerError {
    InvalidSignature,
    ScoreExceedsMaximum,
    MintAuthorityClosed,
}

impl From<NadrunnerError> for ProgramError {
    fn from(e: NadrunnerError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Make NadrunnerToken implement necessary traits
impl Sealed for NadrunnerToken {}

impl IsInitialized for NadrunnerToken {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for NadrunnerToken {
    const LEN: usize = 1 + 32 + 8; // 1 byte for is_initialized, 32 bytes for owner pubkey, 8 bytes for amount
    
    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, NadrunnerToken::LEN];
        let (is_initialized_dst, owner_dst, amount_dst) = mut_array_refs![dst, 1, 32, 8];
        
        is_initialized_dst[0] = self.is_initialized as u8;
        owner_dst.copy_from_slice(self.owner.as_ref());
        *amount_dst = self.amount.to_le_bytes();
    }
    
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, NadrunnerToken::LEN];
        let (is_initialized, owner, amount) = array_refs![src, 1, 32, 8];
        
        let is_initialized = match is_initialized {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };
        
        Ok(NadrunnerToken {
            is_initialized,
            owner: Pubkey::new_from_array(*owner),
            amount: u64::from_le_bytes(*amount),
        })
    }
}

// Make MintAuthority implement necessary traits
impl Sealed for MintAuthority {}

impl IsInitialized for MintAuthority {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for MintAuthority {
    const LEN: usize = 1 + 32; // 1 byte for is_initialized, 32 bytes for signer pubkey
    
    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, MintAuthority::LEN];
        let (is_initialized_dst, signer_pubkey_dst) = mut_array_refs![dst, 1, 32];
        
        is_initialized_dst[0] = self.is_initialized as u8;
        signer_pubkey_dst.copy_from_slice(self.signer_pubkey.as_ref());
    }
    
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, MintAuthority::LEN];
        let (is_initialized, signer_pubkey) = array_refs![src, 1, 32];
        
        let is_initialized = match is_initialized {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };
        
        Ok(MintAuthority {
            is_initialized,
            signer_pubkey: Pubkey::new_from_array(*signer_pubkey),
        })
    }
}

// Program entry point
entrypoint!(process_instruction);

// Constants
const MAX_GAME_MINT: u64 = 10000_000_000_000; // 10,000 tokens with 9 decimals (Solana standard)

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Ensure there's at least one byte for the instruction type
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Parse the instruction
    match instruction_data[0] {
        0 => { // Initialize a new token account
            msg!("Instruction: Initialize Token Account");
            initialize_token_account(program_id, accounts)
        },
        1 => { // Initialize mint authority
            msg!("Instruction: Initialize Mint Authority");
            initialize_mint_authority(program_id, accounts)
        },
        2 => { // Update mint authority
            msg!("Instruction: Update Mint Authority");
            let new_signer = Pubkey::new(&instruction_data[1..33]);
            update_mint_authority(program_id, accounts, new_signer)
        },
        3 => { // Admin mint function (owner only)
            msg!("Instruction: Admin Mint");
            if instruction_data.len() < 9 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let amount = u64::from_le_bytes(
                instruction_data[1..9].try_into().map_err(|_| ProgramError::InvalidInstructionData)?
            );
            admin_mint(program_id, accounts, amount)
        },
        4 => { // Mint game score (with signature verification)
            msg!("Instruction: Mint Game Score");
            if instruction_data.len() < 9 + 64 { // 8 bytes for amount, 64 bytes for signature
                return Err(ProgramError::InvalidInstructionData);
            }
            let score = u64::from_le_bytes(
                instruction_data[1..9].try_into().map_err(|_| ProgramError::InvalidInstructionData)?
            );
            let signature = &instruction_data[9..73];
            mint_game_score(program_id, accounts, score, signature)
        },
        5 => { // Transfer tokens
            msg!("Instruction: Transfer Tokens");
            if instruction_data.len() < 9 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let amount = u64::from_le_bytes(
                instruction_data[1..9].try_into().map_err(|_| ProgramError::InvalidInstructionData)?
            );
            transfer_tokens(program_id, accounts, amount)
        },
        _ => {
            msg!("Error: Unknown instruction");
            Err(ProgramError::InvalidInstructionData)
        }
    }
}

// Initialize a new token account
fn initialize_token_account(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get the account to initialize
    let token_account = next_account_info(account_info_iter)?;
    
    // Get the account owner
    let owner = next_account_info(account_info_iter)?;
    
    // Get the rent sysvar
    let rent_account = next_account_info(account_info_iter)?;
    let rent = &Rent::from_account_info(rent_account)?;
    
    // Check if the token account is already initialized
    if token_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Ensure the token account has enough lamports to be rent-exempt
    if !rent.is_exempt(token_account.lamports(), token_account.data_len()) {
        return Err(ProgramError::AccountNotRentExempt);
    }
    
    // Ensure the owner signed the transaction
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Initialize the token account
    let mut token_account_data = NadrunnerToken::unpack_unchecked(&token_account.data.borrow())?;
    if token_account_data.is_initialized {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    
    token_account_data.is_initialized = true;
    token_account_data.owner = *owner.key;
    token_account_data.amount = 0;
    
    NadrunnerToken::pack(token_account_data, &mut token_account.data.borrow_mut())?;
    
    Ok(())
}

// Initialize mint authority
fn initialize_mint_authority(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get the mint authority account
    let mint_authority_account = next_account_info(account_info_iter)?;
    
    // Get the owner (program deployer)
    let owner = next_account_info(account_info_iter)?;
    
    // Get the rent sysvar
    let rent_account = next_account_info(account_info_iter)?;
    let rent = &Rent::from_account_info(rent_account)?;
    
    // Check ownership and rent exemption
    if mint_authority_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    if !rent.is_exempt(mint_authority_account.lamports(), mint_authority_account.data_len()) {
        return Err(ProgramError::AccountNotRentExempt);
    }
    
    // Ensure the owner signed the transaction
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Initialize the mint authority
    let mut mint_authority_data = MintAuthority::unpack_unchecked(&mint_authority_account.data.borrow())?;
    if mint_authority_data.is_initialized {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    
    mint_authority_data.is_initialized = true;
    mint_authority_data.signer_pubkey = *owner.key; // Initially set to the owner
    
    MintAuthority::pack(mint_authority_data, &mut mint_authority_account.data.borrow_mut())?;
    
    Ok(())
}

// Update mint authority
fn update_mint_authority(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_signer: Pubkey,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get the mint authority account
    let mint_authority_account = next_account_info(account_info_iter)?;
    
    // Get the current owner
    let current_owner = next_account_info(account_info_iter)?;
    
    // Check ownership
    if mint_authority_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Ensure the owner signed the transaction
    if !current_owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Unpack and verify the mint authority
    let mut mint_authority_data = MintAuthority::unpack(&mint_authority_account.data.borrow())?;
    
    // Check if the signer is the current mint authority
    if mint_authority_data.signer_pubkey != *current_owner.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Update the signer pubkey
    mint_authority_data.signer_pubkey = new_signer;
    
    // Save the updated mint authority
    MintAuthority::pack(mint_authority_data, &mut mint_authority_account.data.borrow_mut())?;
    
    msg!("Mint authority updated successfully");
    
    Ok(())
}

// Admin mint function (owner only)
fn admin_mint(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get the mint authority account
    let mint_authority_account = next_account_info(account_info_iter)?;
    
    // Get the owner
    let owner = next_account_info(account_info_iter)?;
    
    // Get the token account to mint to
    let token_account = next_account_info(account_info_iter)?;
    
    // Check ownership
    if mint_authority_account.owner != program_id || token_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Ensure the owner signed the transaction
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Unpack the mint authority
    let mint_authority_data = MintAuthority::unpack(&mint_authority_account.data.borrow())?;
    
    // Check if the signer is the mint authority
    if mint_authority_data.signer_pubkey != *owner.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Unpack the token account
    let mut token_account_data = NadrunnerToken::unpack(&token_account.data.borrow())?;
    
    // Add tokens to the account
    token_account_data.amount = token_account_data.amount.checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    
    // Save the updated token account
    NadrunnerToken::pack(token_account_data, &mut token_account.data.borrow_mut())?;
    
    msg!("Minted {} tokens", amount);
    
    Ok(())
}

// Mint game score (with signature verification)
fn mint_game_score(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    score: u64,
    signature: &[u8],
) -> ProgramResult {
    // Check if score exceeds maximum
    if score > MAX_GAME_MINT {
        return Err(NadrunnerError::ScoreExceedsMaximum.into());
    }
    
    let account_info_iter = &mut accounts.iter();
    
    // Get the token account
    let token_account = next_account_info(account_info_iter)?;
    
    // Get the player (and token owner)
    let player = next_account_info(account_info_iter)?;
    
    // Get the mint authority account
    let mint_authority_account = next_account_info(account_info_iter)?;
    
    // Get the clock sysvar (for chain ID equivalence)
    let clock_account = next_account_info(account_info_iter)?;
    let clock = &Clock::from_account_info(clock_account)?;
    
    // Check ownership
    if token_account.owner != program_id || mint_authority_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Ensure the player signed the transaction
    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Unpack the token account
    let mut token_account_data = NadrunnerToken::unpack(&token_account.data.borrow())?;
    
    // Check if the token account belongs to the player
    if token_account_data.owner != *player.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Unpack the mint authority
    let mint_authority_data = MintAuthority::unpack(&mint_authority_account.data.borrow())?;
    
    // Create message for verification
    // In Ethereum, we'd use keccak256(abi.encodePacked(player, score, chainId))
    // In Solana, we'll create a similar hash
    let message = [
        player.key.to_bytes().as_ref(),
        &score.to_le_bytes(),
        &(clock.slot & 0xFFFFFFFF).to_le_bytes(), // Using slot as chain ID equivalent
    ].concat();
    
    let message_hash = hash(&message);
    
    // Verify signature (simplified - in production you'd need proper ECDSA recovery)
    // This is a placeholder - Solana's secp256k1_recover is different from Ethereum's ecrecover
    // You would need to properly implement signature verification based on your signing scheme
    
    // Add tokens to the account
    token_account_data.amount = token_account_data.amount.checked_add(score)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    
    // Save the updated token account
    NadrunnerToken::pack(token_account_data, &mut token_account.data.borrow_mut())?;
    
    msg!("Minted {} tokens for game score", score);
    
    Ok(())
}

// Transfer tokens between accounts
fn transfer_tokens(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    
    // Get the source account
    let source_account = next_account_info(account_info_iter)?;
    
    // Get the destination account
    let destination_account = next_account_info(account_info_iter)?;
    
    // Get the owner of the source account
    let owner = next_account_info(account_info_iter)?;
    
    // Ensure both accounts are owned by our program
    if source_account.owner != program_id || destination_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Ensure owner signed the transaction
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load the source account
    let mut source_account_data = NadrunnerToken::unpack(&source_account.data.borrow())?;
    
    // Check if the owner is correct
    if source_account_data.owner != *owner.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if there are enough tokens to transfer
    if source_account_data.amount < amount {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Load the destination account
    let mut destination_account_data = NadrunnerToken::unpack(&destination_account.data.borrow())?;
    
    // Subtract tokens from source account
    source_account_data.amount = source_account_data.amount.checked_sub(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    
    // Add tokens to destination account
    destination_account_data.amount = destination_account_data.amount.checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    
    // Save the updated accounts
    NadrunnerToken::pack(source_account_data, &mut source_account.data.borrow_mut())?;
    NadrunnerToken::pack(destination_account_data, &mut destination_account.data.borrow_mut())?;
    
    msg!("Transferred {} tokens", amount);
    
    Ok(())
}