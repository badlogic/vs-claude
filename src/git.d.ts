// Minimal type definitions for VS Code Git extension API
// Based on the official git extension API

import { Uri, Event } from 'vscode';

export type APIState = 'uninitialized' | 'initialized';

export interface GitExtension {
    getAPI(version: 1): GitAPI;
}

export interface GitAPI {
    readonly state: APIState;
    readonly onDidChangeState: Event<APIState>;
    readonly repositories: Repository[];
    readonly onDidOpenRepository: Event<Repository>;
    readonly onDidCloseRepository: Event<Repository>;
    toGitUri(uri: Uri, ref: string): Uri;
}

export interface Repository {
    rootUri: Uri;
}
