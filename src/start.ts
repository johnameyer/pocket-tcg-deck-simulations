#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

void yargs(hideBin(process.argv))
    .command('start', 'Start the application', () => {
        console.log('Application started');
    })
    .parseAsync();
