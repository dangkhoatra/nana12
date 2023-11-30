require("dotenv").config();
const nearAPI = require("near-api-js");
const { connect, KeyPair, keyStores } = nearAPI;
const { parseSeedPhrase } = require("near-seed-phrase");
const { readFileSync } = require("fs");
const { utils } = require("near-api-js");

async function main() {
  let walletData = [];
  const mnemonic = process.env.MNEMONIC;
  const { secretKey } = parseSeedPhrase(mnemonic);
  const mainWallet = {
    privateKey: secretKey,
    implicitAccountId: process.env.CONTRACT_NAME,
  };
  try {
    walletData = JSON.parse(readFileSync("near_wallets.json", "utf-8"));
  } catch (e) {
    console.log("near_wallets.json not found, using configured main wallet");
  }
  walletData.push(mainWallet);
  const contractArgs = {
    p: "nrc-20",
    op: "mint",
    amt: "100000000",
    tick: "neat",
  };

  async function performInscribe(wallet, contractArgs, numberOfTimes) {
    const config = {
      networkId: process.env.NETWORK_ID || "mainnet",
      keyStore: new keyStores.InMemoryKeyStore(),
      nodeUrl: process.env.NODE_URL,
    };
    const keyPair = KeyPair.fromString(wallet.privateKey);
    await config.keyStore.setKey(
      config.networkId,
      wallet.implicitAccountId,
      keyPair
    );
    const near = await connect(config);
    const account = await near.account(wallet.implicitAccountId);
    const balance = await account.getAccountBalance();
    console.log(
      `Account ${wallet.implicitAccountId} balance: ${
        balance.available / 10 ** 24
      }`
    );
    for (let i = 0; i < numberOfTimes; i++) {
      try {
        if (utils.format.parseNearAmount(balance.available) > 0) {
          const result = await account.functionCall({
            contractId: "inscription.near",
            methodName: "inscribe",
            args: contractArgs,
            gas: "30000000000000",
            attachedDeposit: "0",
          });
          let hash = result.transaction.hash;
          console.log(
            `${wallet.implicitAccountId}, No. ${i + 1} operations successful: ${
              "https://getblock.io/explorers/near/transactions/" + hash
            }`
          );
        } else {
          console.log(
            `Account ${wallet.implicitAccountId} Insufficient balance`
          );
          break; // If the balance is insufficient, jump out of the loop
        }
      } catch (error) {
        console.error(`第 ${i + 1} 次操作失败: `, error);
      }
    }
  }

  // 10 operations means 10 operations for each wallet
  Promise.all(
    walletData.map((wallet) => performInscribe(wallet, contractArgs, 9999))
  )
    .then(() => {
      console.log("All operations completed");
    })
    .catch((error) => {
      console.error("An error occurred during operation: ", error);
    });
}

main();
