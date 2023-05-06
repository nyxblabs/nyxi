import { resolve } from 'node:path'
import * as tyck from '@tyck/prompts'
import { execaCommand } from 'execa'
import c from 'kleur'
import { consolji } from 'consolji'
import { version } from '../package.json'
import type { Agent } from './agents'
import { agents } from './agents'
import { getDefaultAgent, getGlobalAgent } from './config'
import type { DetectOptions } from './detect'
import { detect } from './detect'
import { getVoltaPrefix, remove } from './utils'
import { UnsupportedCommand } from './parse'

const DEBUG_SIGN = '?'

export interface RunnerContext {
  hasLock?: boolean
  cwd?: string
}

export type Runner = (agent: Agent, args: string[], ctx?: RunnerContext) => Promise<string | undefined> | string | undefined

export async function runCli(fn: Runner, options: DetectOptions = {}) {
  const args = process.argv.slice(2).filter(Boolean)
  try {
    await run(fn, args, options)
  }
  catch (error) {
    if (error instanceof UnsupportedCommand)
      consolji.log(c.red(`\u2717 ${error.message}`))

    process.exit(1)
  }
}

export async function run(fn: Runner, args: string[], options: DetectOptions = {}) {
  const debug = args.includes(DEBUG_SIGN)
  if (debug)
    remove(args, DEBUG_SIGN)

  let cwd = process.cwd()
  let command

  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    consolji.log(`@nyxb/nyxi v${version}`)
    return
  }

  if (args.length === 1 && ['-h', '--help'].includes(args[0])) {
    const dash = c.dim('-')
    consolji.log(c.green(c.bold('@nyxb/nyxi')) + c.dim(` use the right package manager v${version}\n`))
    consolji.log(`nyxi   ${dash}  install`)
    consolji.log(`nyxr   ${dash}  run`)
    consolji.log(`nyxlx  ${dash}  execute`)
    consolji.log(`nyxu   ${dash}  upgrade`)
    consolji.log(`nyxun  ${dash}  uninstall`)
    consolji.log(`nyxci  ${dash}  clean install`)
    consolji.log(`nyxa   ${dash}  agent alias`)
    consolji.log(c.yellow('\ncheck https://github.com/nyxb/nyxi for more documentation.'))
    return
  }

  if (args[0] === '-C') {
    cwd = resolve(cwd, args[1])
    args.splice(0, 2)
  }

  const isGlobal = args.includes('-g')
  if (isGlobal) {
    command = await fn(await getGlobalAgent(), args)
  }
  else {
    let agent: string = await detect({ ...options, cwd }) || await getDefaultAgent()
    if (!agents.includes(agent as Agent)) {
      const result = await tyck.select({
        message: 'Choose the agent',
        options: agents.filter(i => !i.includes('@')).map(value => ({ label: value, value })),
      })

      if (tyck.isCancel(result)) {
        tyck.cancel('nevermind')
        process.exit(0)
      }
      agent = result as Agent

      if (!agent)
        return
    }

    command = await fn(agent as Agent, args, {
      hasLock: Boolean(agent),
      cwd,
    })
  }

  if (!command)
    return

  const voltaPrefix = getVoltaPrefix()
  if (voltaPrefix)
    command = voltaPrefix.concat(' ').concat(command)

  if (debug) {
    consolji.log(command)
    return
  }

  await execaCommand(command, { stdio: 'inherit', encoding: 'utf-8', cwd })
}
