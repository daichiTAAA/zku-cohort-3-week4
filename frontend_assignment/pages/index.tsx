import detectEthereumProvider from '@metamask/detect-provider';
import { Strategy, ZkIdentity } from '@zk-kit/identity';
import { generateMerkleProof, Semaphore } from '@zk-kit/protocols';
import { providers } from 'ethers';
import Head from 'next/head';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@material-ui/core';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [logs, setLogs] = React.useState('Connect your wallet and greet!');
  const defaultGreeting = 'Hello';
  const [greeting, setGreeting] = useState(defaultGreeting);
  const [greetingBytes, setGreetingBytes] = useState('');

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm({
    defaultValues: {
      greeting: defaultGreeting,
    },
  });

  useEffect(() => {
    const bytesSize = new Blob([greeting]).size;
    setGreetingBytes(String(bytesSize));
  }, [greeting]);

  async function greet() {
    setLogs('Creating your Semaphore identity...');

    const provider = (await detectEthereumProvider()) as any;

    await provider.request({ method: 'eth_requestAccounts' });

    const ethersProvider = new providers.Web3Provider(provider);
    const signer = ethersProvider.getSigner();
    const message = await signer.signMessage(
      'Sign this message to create your identity!'
    );

    const identity = new ZkIdentity(Strategy.MESSAGE, message);
    const identityCommitment = identity.genIdentityCommitment();
    const identityCommitments = await (
      await fetch('./identityCommitments.json')
    ).json();

    const merkleProof = generateMerkleProof(
      20,
      BigInt(0),
      identityCommitments,
      identityCommitment
    );

    setLogs('Creating your Semaphore proof...');

    const witness = Semaphore.genWitness(
      identity.getTrapdoor(),
      identity.getNullifier(),
      merkleProof,
      merkleProof.root,
      greeting
    );

    const { proof, publicSignals } = await Semaphore.genProof(
      witness,
      './semaphore.wasm',
      './semaphore_final.zkey'
    );

    const solidityProof = Semaphore.packToSolidityProof(proof);

    const response = await fetch('/api/greet', {
      method: 'POST',
      body: JSON.stringify({
        greeting,
        nullifierHash: publicSignals.nullifierHash,
        solidityProof: solidityProof,
      }),
    });

    if (response.status === 500) {
      const errorMessage = await response.text();
      setLogs(errorMessage);
    } else if (response.status === 200) {
      const receivedMessage = await response.text();
      // console.log(receivedMessage);
      setLogs(receivedMessage);
    } else {
      setLogs('Your anonymous greeting is onchain :)');
    }
  }

  const _onChange = (inputText: string) => {
    setGreeting(inputText);
    // console.log('greeting is: ', greeting);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Greetings</title>
        <meta
          name='description'
          content='A simple Next.js/Hardhat greeting application with Semaphore.'
        />
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Greetings</h1>

        <p className={styles.description}>
          A simple Next.js/Hardhat greeting application with Semaphore.
        </p>

        <form
          onSubmit={handleSubmit(() => {
            if (!errors.greeting) {
              greet();
            }
          })}
        >
          <Input
            {...register('greeting', {
              required: 'Input greeting',
              minLength: {
                value: 1,
                message: 'Min length is 1',
              },
              maxLength: {
                value: 31,
                message: 'Max length is 31',
              },
            })}
            placeholder='Input greeting'
            onChange={(e) => _onChange(e.target.value)}
          />
          <p>
            {errors.greeting?.message &&
              greeting.length > 31 &&
              `Max input byte size is 31. Now, ${greetingBytes} bytes.`}
            {errors.greeting?.message &&
              errors.greeting?.message !== 'Max length is 31' &&
              greeting.length === 0 &&
              errors.greeting?.message}
          </p>

          <input className={styles.button} value='Greet' type='submit' />
        </form>

        <div className={styles.logs}>{logs}</div>
      </main>
    </div>
  );
}
