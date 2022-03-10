// Copyright (c) Brock Allen & Dominick Baier. All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

import { Logger, CryptoUtils } from "./utils";
import type { StateStore } from "./StateStore";
import type { ClockService } from "./ClockService";

/**
 * @public
 */
export class State {
    public readonly id: string;
    public readonly created: number;
    public readonly request_type: string | undefined;

    /** custom "state", which can be used by a caller to have "data" round tripped */
    public readonly data: unknown | undefined;

    public constructor(args: {
        id?: string;
        data?: unknown;
        created?: number;
        request_type?: string;
    }, protected readonly _clockService: ClockService) {
        this.id = args.id || CryptoUtils.generateUUIDv4();
        this.data = args.data;

        if (args.created && args.created > 0) {
            this.created = args.created;
        }
        else {
            this.created = this._clockService.getEpochTime();
        }
        this.request_type = args.request_type;
    }

    public toStorageString(): string {
        new Logger("State").create("toStorageString");
        return JSON.stringify({
            id: this.id,
            data: this.data,
            created: this.created,
            request_type: this.request_type,
        });
    }

    public static fromStorageString(storageString: string, clockService: ClockService): State {
        new Logger("State").create("fromStorageString");
        return new State(JSON.parse(storageString), clockService);
    }

    public static async clearStaleState(storage: StateStore, age: number, clockService: ClockService): Promise<void> {
        const logger = new Logger("State").create("clearStaleState");
        const cutoff = clockService.getEpochTime() - age;

        const keys = await storage.getAllKeys();
        logger.debug("got keys", keys);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const item = await storage.get(key);
            let remove = false;

            if (item) {
                try {
                    const state = State.fromStorageString(item, clockService);

                    logger.debug("got item from key: ", key, state.created);
                    if (state.created <= cutoff) {
                        remove = true;
                    }
                }
                catch (err) {
                    logger.error("Error parsing state for key", key, err);
                    remove = true;
                }
            }
            else {
                logger.debug("no item in storage for key: ", key);
                remove = true;
            }

            if (remove) {
                logger.debug("removed item for key: ", key);
                void storage.remove(key);
            }
        }
    }
}
