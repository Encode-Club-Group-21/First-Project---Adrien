import { Contract, ethers } from "ethers";
import "dotenv/config";
import * as ballotJson from "../../artifacts/contracts/Ballot.sol/Ballot.json";
// eslint-disable-next-line node/no-missing-import
import { Ballot } from "../../typechain";
import getWinner from "./getWinner";
// This key is already public on Herong's Tutorial Examples - v1.03, by Dr. Herong Yang
// Do never expose your keys like this
const EXPOSED_KEY =
  "8da4ef21b864d2cc526dbdb2a120bd2874c36c9d0a1fb7f8c63d7f7a8b41de8f";

async function main(ballotAdd?: string) {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);

  console.log(`Using address ${wallet.address}`);
  const provider = ethers.providers.getDefaultProvider("ropsten");
  const signer = wallet.connect(provider);
  if (process.argv.length < 3) throw new Error("Ballot address missing");
  const ballotAddress = ballotAdd || process.argv[2];
  console.log(ballotAddress);
  if (process.argv.length < 4) throw new Error("Proposal Index missing");
  const proposal = process.argv[3];

  console.log(
    `Attaching ballot contract interface to address ${ballotAddress}`
  );
  const ballotContract: Ballot = new Contract(
    ballotAddress,
    ballotJson.abi,
    signer
  ) as Ballot;

  const vote = await ballotContract.vote(proposal);
  await vote.wait();
  const address = wallet.address;
  // seeking confirmation that the address has voted
  const voter = await ballotContract.voters(address);
  console.log(voter, "address", address);
  console.log("vote", vote);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export default main;
