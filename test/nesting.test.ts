import { MessageChannel } from 'node:worker_threads'
import { expect, it } from 'vitest'
import { createBirpc } from '../src'
import * as Alice from './alice'

let bobCount = 0

const talker = {
  hi(name: string) {
    return `Hi ${name}, I am Bob`
  },
}
const counter = {
  bump() {
    bobCount += 1
  },
  getCount() {
    return bobCount
  },
}
const Bob = { talker, counter }

type BobFunctions = typeof Bob
type AliceFunctions = typeof Alice

function createChannel() {
  const channel = new MessageChannel()
  return {
    channel,
    alice: createBirpc<BobFunctions, AliceFunctions>(
      Alice,
      {
        // mark bob's `bump` as an event without response
        eventNames: ['counter.bump'],
        post: data => channel.port2.postMessage(data),
        on: fn => channel.port2.on('message', fn),
      },
    ),
    bob: createBirpc<AliceFunctions, BobFunctions>(
      Bob,
      {
        post: data => channel.port1.postMessage(data),
        on: fn => channel.port1.on('message', fn),
      },
    ),
  }
}

it('basic', async () => {
  const { bob, alice } = createChannel()

  // RPCs
  expect(await bob.hello('Bob'))
    .toEqual('Hello Bob, my name is Alice')
  expect(await alice.talker.hi('Alice'))
    .toEqual('Hi Alice, I am Bob')

  // one-way event
  expect(alice.counter.bump()).toBeUndefined()

  expect(Bob.counter.getCount()).toBe(0)
  await new Promise(resolve => setTimeout(resolve, 1))
  expect(Bob.counter.getCount()).toBe(1)
})

it('async', async () => {
  const { bob, alice } = createChannel()

  await alice
  await bob
})
