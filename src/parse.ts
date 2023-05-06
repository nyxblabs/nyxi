import type { Agent, Command } from './agents'
import { AGENTS } from './agents'
import { exclude } from './utils'
import type { Runner } from './runner'
import { initPackageJson, initTsConfig } from './init'

export function getCommand(
  agent: Agent,
  command: Command,
  args: string[] = [],
) {
  if (!(agent in AGENTS))
    throw new Error(`Unsupported agent "${agent}"`)

  const c = AGENTS[agent][command]

  if (typeof c === 'function')
    return c(args)

  if (!c)
    throw new UnsupportedCommand({ agent, command })

  return c.replace('{0}', args.join(' ')).trim()
}

export const parseNyxi = <Runner>((agent, args, ctx) => {
  // bun use `-d` instead of `-D`, #90
  if (agent === 'bun')
    args = args.map(i => i === '-D' ? '-d' : i)

  if (args.includes('-g'))
    return getCommand(agent, 'global', exclude(args, '-g'))

  if (args.includes('--frozen-if-present')) {
    args = exclude(args, '--frozen-if-present')
    return getCommand(agent, ctx?.hasLock ? 'frozen' : 'install', args)
  }

  if (args.includes('--frozen'))
    return getCommand(agent, 'frozen', exclude(args, '--frozen'))

  if (args.length === 0 || args.every(i => i.startsWith('-')))
    return getCommand(agent, 'install', args)

  return getCommand(agent, 'add', args)
})

export const parseNyxr = <Runner>((agent, args) => {
  if (args.length === 0)
    args.push('start')

  if (args.includes('--if-present')) {
    args = exclude(args, '--if-present')
    args[0] = `--if-present ${args[0]}`
  }

  return getCommand(agent, 'run', args)
})

export const parseNyxu = <Runner>((agent, args) => {
  if (args.includes('-i'))
    return getCommand(agent, 'upgrade-interactive', exclude(args, '-i'))

  return getCommand(agent, 'upgrade', args)
})

export const parseNyxun = <Runner>((agent, args) => {
  if (args.includes('-g'))
    return getCommand(agent, 'global_uninstall', exclude(args, '-g'))
  return getCommand(agent, 'uninstall', args)
})

export const parseNyxlx = <Runner>((agent, args) => {
  return getCommand(agent, 'execute', args)
})

export const parseNyxa = <Runner>((agent, args) => {
  return getCommand(agent, 'agent', args)
})

export class UnsupportedCommand extends Error {
  constructor({ agent, command }: { agent: Agent; command: string }) {
    super(`Command "${command}" is not support by agent "${agent}"`)
  }
}
export const parseNyxinit = <Runner>(async (agent, args, _ctx) => {
  if (args[0] === 'package')
    return initPackageJson()

  if (args[0] === 'tsconfig')
    return initTsConfig()

  throw new UnsupportedCommand({ agent, command: args[0] })
})
