import { expect } from "chai";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { Ballot } from "../../typechain";

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
  }
  return bytes32Array;
}

async function giveRightToVote(ballotContract: Ballot, voterAddress: any) {
  const tx = await ballotContract.giveRightToVote(voterAddress);
  await tx.wait();
}

describe("Ballot", function () {
  let ballotContract: Ballot;
  let accounts: any[];

  this.beforeEach(async function () {
    accounts = await ethers.getSigners();
    const ballotFactory = await ethers.getContractFactory("Ballot");
    ballotContract = await ballotFactory.deploy(
      convertStringArrayToBytes32(PROPOSALS)
    );
    await ballotContract.deployed();
  });

  describe("when the contract is deployed", function () {
    it("has the provided proposals", async function () {
      console.log(accounts[1]);

      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        expect(ethers.utils.parseBytes32String(proposal.name)).to.eq(
          PROPOSALS[index]
        );
      }
    });

    it("has zero votes for all proposals", async function () {
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await ballotContract.proposals(index);
        expect(proposal.voteCount.toNumber()).to.eq(0);
      }
    });

    it("sets the deployer address as chairperson", async function () {
      const chairperson = await ballotContract.chairperson();
      expect(chairperson).to.eq(accounts[0].address);
    });

    it("sets the voting weight for the chairperson as 1", async function () {
      const chairpersonVoter = await ballotContract.voters(accounts[0].address);
      expect(chairpersonVoter.weight.toNumber()).to.eq(1);
    });
  });

  describe("when the chairperson interacts with the giveRightToVote function in the contract", function () {
    it("gives right to vote for another address", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      const voter = await ballotContract.voters(voterAddress);
      expect(voter.weight.toNumber()).to.eq(1);
    });

    it("can not give right to vote for someone that has voted", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await ballotContract.connect(accounts[1]).vote(0);
      await expect(
        giveRightToVote(ballotContract, voterAddress)
      ).to.be.revertedWith("The voter already voted.");
    });

    it("can not give right to vote for someone that has already voting rights", async function () {
      const voterAddress = accounts[1].address;
      await giveRightToVote(ballotContract, voterAddress);
      await expect(
        giveRightToVote(ballotContract, voterAddress)
      ).to.be.revertedWith("");
    });
  });

  describe("when the voter interact with the vote function in the contract", function () {
    describe("when the voter does not have the right to vote", function () {
      it("cannot vote", async function () {
        await expect(
          ballotContract.connect(accounts[1]).vote(0)
        ).to.be.revertedWith("Has no right to vote");
      });
    });
    describe("When the voter can vote", function () {
      it("can vote", async function () {
        const voterAddress = accounts[1].address;
        await giveRightToVote(ballotContract, voterAddress);
        await ballotContract.connect(accounts[1]).vote(0);
        const voterAfter = await ballotContract.voters(accounts[1].address);
        expect(voterAfter.voted).to.eq(true);
      });
    });
  });

  describe("when the voter interact with the delegate function in the contract", function () {
    describe("when it can delegate", function () {
      it("can delegate", async function () {
        await giveRightToVote(ballotContract, accounts[1].address);
        await giveRightToVote(ballotContract, accounts[2].address);

        await ballotContract.connect(accounts[1]).delegate(accounts[2].address);
        const delegatedAddress = await ballotContract.voters(
          accounts[2].address
        );
        expect(delegatedAddress.weight.toNumber()).to.eq(2);
      });
    });
    describe("when it can't delegate", function () {
      it("it can't delegate to himself", async function () {
        await expect(
          ballotContract.connect(accounts[1]).delegate(accounts[1].address)
        ).to.be.revertedWith("Self-delegation is disallowed.");
      });
      it("it can't delegate after voting", async function () {
        await giveRightToVote(ballotContract, accounts[1].address);
        await ballotContract.connect(accounts[1]).vote(0);
        await expect(
          ballotContract.connect(accounts[1]).delegate(accounts[2].address)
        ).to.be.revertedWith("You already voted.");
      });
      it("it can't delegate in a loop", async function () {
        await giveRightToVote(ballotContract, accounts[1].address);
        await giveRightToVote(ballotContract, accounts[2].address);
        await giveRightToVote(ballotContract, accounts[3].address);

        await ballotContract.connect(accounts[1]).delegate(accounts[2].address);
        await ballotContract.connect(accounts[2]).delegate(accounts[3].address);
        await expect(
          ballotContract.connect(accounts[3]).delegate(accounts[1].address)
        ).to.be.revertedWith("Found loop in delegation.");
      });
    });
  });

  describe("when an attacker interact with the giveRightToVote function in the contract", function () {
    // TODO
    it("it can't give weight to the delegate ", async function () {
      await expect(
        ballotContract.connect(accounts[1]).giveRightToVote(accounts[2].address)
      ).to.be.revertedWith("Only chairperson can give right to vote.");
    });
  });

  describe("when the an attacker interact with the vote function in the contract", function () {
    // TODO
    it("it can't vote", async function () {
      await expect(
        ballotContract.connect(accounts[1]).vote(0)
      ).to.be.revertedWith("Has no right to vote");
    });
  });

  describe("when an attacker interact with the delegate function in the contract", function () {
    // TODO
    it("they can't add weight to the delegate ", async function () {
      await giveRightToVote(ballotContract, accounts[2].address);
      await ballotContract.connect(accounts[1]).delegate(accounts[2].address);

      const delegate = await ballotContract.voters(accounts[2].address);
      expect(delegate.weight.toNumber()).to.eq(1);
    });
  });

  describe("when someone interact with the winningProposal function before any votes are cast", function () {
    it("gives 0 as the winning proposal", async function () {
      const winningPropo = await ballotContract
        .connect(accounts[0])
        .winningProposal();
      expect(winningPropo.toNumber()).to.eq(0);
    });
  });

  describe("when someone interact with the winningProposal function after one vote is cast for the first proposal", function () {
    it("gives 1 as the winning proposal", async function () {
      await giveRightToVote(ballotContract, accounts[2].address);
      await ballotContract.connect(accounts[2]).vote(1);
      const winningPropo = await ballotContract
        .connect(accounts[0])
        .winningProposal();
      expect(winningPropo.toNumber()).to.eq(1);
    });
  });

  describe("when someone interact with the winnerName function before any votes are cast", function () {
    it("Should return proposal 0", async function () {
      const winningPropo = await ballotContract
        .connect(accounts[0])
        .winnerName();
      expect(ethers.utils.parseBytes32String(winningPropo)).to.eq(PROPOSALS[0]);
    });
  });

  describe("when someone interact with the winnerName function after one vote is cast for the first proposal", function () {
    // TODO
    it("should return Proposal 1", async function () {
      await giveRightToVote(ballotContract, accounts[2].address);
      await ballotContract.connect(accounts[2]).vote(1);
      const winningPropo = await ballotContract
        .connect(accounts[0])
        .winnerName();
      expect(ethers.utils.parseBytes32String(winningPropo)).to.eq(PROPOSALS[1]);
    });
  });

  describe("when someone interact with the winningProposal function and winnerName after 5 random votes are cast for the proposals", function () {
    // TODO
    it("Returns a winner and a winnername", async function () {
      let zero = 0;
      let one = 0;
      let two = 0;
      for (let i = 1; i <= 5; i++) {
        const random = Math.ceil(Math.random() * 2);
        await giveRightToVote(ballotContract, accounts[i].address);

        await ballotContract.connect(accounts[i]).vote(random);
        if (random === 0) zero++;
        if (random === 1) one++;
        if (random === 2) two++;
      }
      const highestNumberArray = [zero, one, two];
      const highestNumber = Math.max(...highestNumberArray);
      const indexOfHighestNumber = highestNumberArray.indexOf(highestNumber);
      console.log(indexOfHighestNumber);
      const winningPropo = await ballotContract
        .connect(accounts[0])
        .winningProposal();
      const winningPropoName = await ballotContract
        .connect(accounts[0])
        .winnerName();
      expect(winningPropo.toNumber()).to.eq(indexOfHighestNumber);
      expect(ethers.utils.parseBytes32String(winningPropoName)).to.eq(
        PROPOSALS[indexOfHighestNumber]
      );
    });
  });
});
