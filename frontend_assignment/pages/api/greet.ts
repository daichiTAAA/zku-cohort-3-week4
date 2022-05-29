import Greeter from 'artifacts/contracts/Greeters.sol/Greeters.json';
import { Contract, providers, utils } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';
import { greetersAddress } from '../../config';

// This API can represent a backend.
// The contract owner is the only account that can call the `greet` function,
// However they will not be aware of the identity of the users generating the proofs.

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    greeting,
    nullifierHash,
    solidityProof,
  }: { greeting: string; nullifierHash: string; solidityProof: Array<string> } =
    JSON.parse(req.body);
  const provider = new providers.JsonRpcProvider('http://127.0.0.1:8545');
  const signer0 = provider.getSigner();

  const contract = new Contract(greetersAddress, Greeter.abi);

  const contractOwner = contract.connect(signer0);

  try {
    let message = '';

    contractOwner.on('NewGreeting', (event) => {
      message = utils.parseBytes32String(event);
      res.emit('gotMessage');
    });

    await contractOwner.greet(
      utils.formatBytes32String(greeting),
      nullifierHash,
      solidityProof
    );

    res.on('gotMessage', (_) => {
      console.log('message is: ', message);
      res.status(200).send(message || "Message hasn't been received.");
    });
  } catch (error: any) {
    const { message } = JSON.parse(error.body).error;
    const reason = message.substring(
      message.indexOf("'") + 1,
      message.lastIndexOf("'")
    );

    res.status(500).send(reason || 'Unknown error!');
  }
}
