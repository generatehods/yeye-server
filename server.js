import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction
} from "@solana/spl-token";

dotenv.config();
const app = express();
app.use(bodyParser.json());

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// CONFIG
const TREASURY_SECRET = JSON.parse(process.env.TREASURY_SECRET);
const treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(TREASURY_SECRET));

const TREASURY_PUBKEY = treasuryKeypair.publicKey;
const TOKEN_MINT = new PublicKey(process.env.TOKEN_MINT);
const DECIMALS = Number(process.env.TOKEN_DECIMALS);

console.log("Loaded treasury:", TREASURY_PUBKEY.toString());

app.post("/claim-reward", async (req, res) => {
  try {
    const { player } = req.body;
    if (!player) return res.status(400).json({ error: "player required" });

    const playerPub = new PublicKey(player);
    const playerAta = await getAssociatedTokenAddress(TOKEN_MINT, playerPub);
    const treasuryAta = await getAssociatedTokenAddress(TOKEN_MINT, TREASURY_PUBKEY, true);

    const tx = new Transaction();

    const playerAtaInfo = await connection.getAccountInfo(playerAta);
    if (!playerAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          TREASURY_PUBKEY,
          playerAta,
          playerPub,
          TOKEN_MINT
        )
      );
    }

    const amount = BigInt(1) * BigInt(10 ** DECIMALS);

    tx.add(
      createTransferCheckedInstruction(
        treasuryAta,
        TOKEN_MINT,
        playerAta,
        TREASURY_PUBKEY,
        amount,
        DECIMALS
      )
    );

    tx.feePayer = TREASURY_PUBKEY;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    tx.sign(treasuryKeypair);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    return res.json({ success: true, signature: sig });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log("Server berjalan di port", process.env.PORT);
});
