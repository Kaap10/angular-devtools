#!/usr/bin/env node
import { createCac } from 'devframe/adapters/cac'
import ngDevtools from './src/node/devframe.ts'

createCac(ngDevtools, { mcp: true }).parse()
