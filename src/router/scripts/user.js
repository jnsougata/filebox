async function fetchInstances() {
    fetch("https://deta.space/api/v0/instances")
    .then(response => response.json())
    .then(data => {
        console.log(data);
    })
}

async function findInstanceIdByHost(host) {
    const  instances = await fetchInstances();
    for (const instance of instances) {
        if (instance.legacy_url === `https://${host}`) {
            return instance.id;
        }
    }
    return "";
}

let abc = {
    "instances": [
        {
            "id": "c0ans8YUJN1H",
            "app_id": "7e9e2ae6-a274-48d7-9083-c51d20892e3f",
            "installation_id": "4e67432d-a7cf-42c8-aaf5-9a5d5eac7836",
            "installation": {
                "id": "4e67432d-a7cf-42c8-aaf5-9a5d5eac7836",
                "app_id": "7e9e2ae6-a274-48d7-9083-c51d20892e3f",
                "release_id": "4791d123-16f6-4997-a3e8-184200fee6d4",
                "instance_id": "",
                "created_at": "2022-12-13T11:28:40.488379Z",
                "updated_at": "2022-12-13T11:28:40.488379Z",
                "status": "complete",
                "is_update": true
            },
            "release": {
                "id": "4791d123-16f6-4997-a3e8-184200fee6d4",
                "name": "codebin-dev-mxjB",
                "app_name": "codebin",
                "short_description": "",
                "release_alias": "codebin",
                "version": "dev-mxjB",
                "channel": "development",
                "icon_url": "https://s3.eu-central-1.amazonaws.com/deta-app-icons.144798365827.eu-central-1/a7e5b39e-f6bf-414a-94c5-b0f0e8526249/icons/icon",
                "app_id": "7e9e2ae6-a274-48d7-9083-c51d20892e3f",
                "released_at": "2022-12-13T11:28:19.078573Z",
                "status": "active",
                "latest": true,
                "author": "",
                "notes": "",
                "app_promotion_id": {
                    "String": "4791d123-16f6-4997-a3e8-184200fee6d4",
                    "Valid": true
                },
                "micros": null,
                "placeholder_icon_config": {
                    "css_background": "background-color: hsl(70, 100%, 80%); background-image: radial-gradient(at 16% 99%, hsl(70, 100%, 80%) 0px, transparent 50%),radial-gradient(at 12% 92%, hsl(70, 100%, 76%) 0px, transparent 50%),radial-gradient(at 43% 86%, hsl(40, 100%, 75%) 0px, transparent 50%),radial-gradient(at 83% 91%, hsl(220, 100%, 79%) 0px, transparent 50%),radial-gradient(at 20% 42%, hsl(-80, 100%, 71%) 0px, transparent 50%),radial-gradient(at 12% 75%, hsl(220, 100%, 82%) 0px, transparent 50%);"
                },
                "revision": {
                    "id": "a7e5b39e-f6bf-414a-94c5-b0f0e8526249",
                    "tag": "locust-6xrp",
                    "app_id": "7e9e2ae6-a274-48d7-9083-c51d20892e3f",
                    "app_name": "",
                    "created_at": "2022-12-13T11:28:19.046432Z",
                    "updated_at": "2022-12-13T11:28:19.046432Z"
                }
            },
            "installed_at": "2022-10-12T15:14:14.759556Z",
            "updated_at": "2022-12-13T11:28:40.516428Z",
            "alias": "dev-gar-codebin",
            "secondary_alias": "codebin-1-k2909767",
            "micros": [
                {
                    "id": "a6056b17-6bfd-46e8-8f3c-2c95daf967f9",
                    "name": "codebin",
                    "app_instance_id": "c0ans8YUJN1H",
                    "presets": {
                        "env": [],
                        "memory": 0,
                        "timeout": 0,
                        "api_keys": false
                    },
                    "public_routes": null,
                    "path": "/",
                    "engine": "python3.9",
                    "url_version": "0"
                }
            ],
            "url": "https://codebin-1-k2909767.deta.app",
            "legacy_url": "https://dev-gar-codebin.gyrooo.deta.app",
            "update": {
                "available": false
            },
            "api_keys": null,
            "keys": null,
            "migrated": false
        },
        {
            "id": "c0hgY947hWs4",
            "app_id": "cf1f2cec-2be6-4343-a9fb-bfaad8e6a4be",
            "installation_id": "5732e397-49ac-43e1-9040-6a98d05bbbb5",
            "installation": {
                "id": "5732e397-49ac-43e1-9040-6a98d05bbbb5",
                "app_id": "cf1f2cec-2be6-4343-a9fb-bfaad8e6a4be",
                "release_id": "b586a1e4-b64a-4ae8-bb04-975ad96804ee",
                "instance_id": "",
                "created_at": "2022-10-20T02:40:05.300906Z",
                "updated_at": "2022-10-20T02:40:05.300906Z",
                "status": "complete",
                "is_update": true
            },
            "release": {
                "id": "b586a1e4-b64a-4ae8-bb04-975ad96804ee",
                "name": "musique-2td-dev-QkWG",
                "app_name": "musique",
                "short_description": "",
                "release_alias": "dev-wallaby-musique-2td",
                "version": "dev-QkWG",
                "channel": "development",
                "icon_url": "",
                "app_id": "cf1f2cec-2be6-4343-a9fb-bfaad8e6a4be",
                "released_at": "2022-10-20T02:39:44.901283Z",
                "status": "active",
                "latest": true,
                "author": "",
                "notes": "",
                "app_promotion_id": {
                    "String": "b586a1e4-b64a-4ae8-bb04-975ad96804ee",
                    "Valid": true
                },
                "micros": null,
                "placeholder_icon_config": {
                    "css_background": "background-color: hsl(143, 100%, 80%); background-image: radial-gradient(at 28% 1%, hsl(143, 100%, 80%) 0px, transparent 50%),radial-gradient(at 40% 22%, hsl(143, 100%, 76%) 0px, transparent 50%),radial-gradient(at 17% 56%, hsl(113, 100%, 75%) 0px, transparent 50%),radial-gradient(at 33% 97%, hsl(293, 100%, 79%) 0px, transparent 50%),radial-gradient(at 21% 38%, hsl(-7, 100%, 71%) 0px, transparent 50%),radial-gradient(at 53% 21%, hsl(293, 100%, 82%) 0px, transparent 50%);"
                },
                "revision": {
                    "id": "33913846-8f5a-417d-ae9c-be1a383d0ae0",
                    "tag": "monarch-gn9b",
                    "app_id": "cf1f2cec-2be6-4343-a9fb-bfaad8e6a4be",
                    "app_name": "",
                    "created_at": "2022-10-20T02:39:44.883062Z",
                    "updated_at": "2022-10-20T02:39:44.883062Z"
                }
            },
            "installed_at": "2022-10-17T07:31:28.470693Z",
            "updated_at": "2022-10-20T02:40:05.319606Z",
            "alias": "dev-wallaby-musique-2td",
            "secondary_alias": "musique-2td-1-a6916378",
            "micros": [
                {
                    "id": "2c1875c8-f36a-4564-8684-d98575ff9b2e",
                    "name": "musique",
                    "app_instance_id": "c0hgY947hWs4",
                    "presets": {
                        "env": [],
                        "memory": 0,
                        "timeout": 0,
                        "api_keys": false
                    },
                    "public_routes": null,
                    "path": "/",
                    "engine": "python3.9",
                    "url_version": "0"
                }
            ],
            "url": "https://musique-2td-1-a6916378.deta.app",
            "legacy_url": "https://dev-wallaby-musique-2td.gyrooo.deta.app",
            "update": {
                "available": false
            },
            "api_keys": null,
            "keys": null,
            "migrated": false
        },
        {
            "id": "c0crGHgsVM8C",
            "app_id": "ebf93464-fbc4-4a13-ae67-85ba912dda22",
            "installation_id": "b8d941fd-fe3d-44d8-8378-28af85e0cca1",
            "installation": {
                "id": "b8d941fd-fe3d-44d8-8378-28af85e0cca1",
                "app_id": "ebf93464-fbc4-4a13-ae67-85ba912dda22",
                "release_id": "f7de4c2f-8b90-46ee-92e2-e95101b3b801",
                "instance_id": "",
                "created_at": "2023-01-30T01:05:17.819204Z",
                "updated_at": "2023-01-30T01:05:17.819204Z",
                "status": "complete",
                "is_update": true
            },
            "release": {
                "id": "f7de4c2f-8b90-46ee-92e2-e95101b3b801",
                "name": "filebox-dev-QBgc",
                "app_name": "filebox",
                "short_description": "",
                "release_alias": "filebox",
                "version": "dev-QBgc",
                "channel": "development",
                "icon_url": "https://s3.eu-central-1.amazonaws.com/deta-app-icons.144798365827.eu-central-1/80f21279-3b96-4520-893b-18f0567add76/icons/icon",
                "app_id": "ebf93464-fbc4-4a13-ae67-85ba912dda22",
                "released_at": "2023-01-30T01:05:14.383954Z",
                "status": "active",
                "latest": true,
                "author": "",
                "notes": "",
                "app_promotion_id": {
                    "String": "f7de4c2f-8b90-46ee-92e2-e95101b3b801",
                    "Valid": true
                },
                "micros": null,
                "placeholder_icon_config": {
                    "css_background": "background-color: hsl(44, 100%, 80%); background-image: radial-gradient(at 32% 88%, hsl(44, 100%, 80%) 0px, transparent 50%),radial-gradient(at 60% 2%, hsl(44, 100%, 76%) 0px, transparent 50%),radial-gradient(at 98% 67%, hsl(14, 100%, 75%) 0px, transparent 50%),radial-gradient(at 58% 69%, hsl(194, 100%, 79%) 0px, transparent 50%),radial-gradient(at 7% 40%, hsl(-106, 100%, 71%) 0px, transparent 50%),radial-gradient(at 72% 94%, hsl(194, 100%, 82%) 0px, transparent 50%);"
                },
                "revision": {
                    "id": "80f21279-3b96-4520-893b-18f0567add76",
                    "tag": "wren-1gnn",
                    "app_id": "ebf93464-fbc4-4a13-ae67-85ba912dda22",
                    "app_name": "",
                    "created_at": "2023-01-30T01:05:14.352577Z",
                    "updated_at": "2023-01-30T01:05:14.352577Z"
                }
            },
            "installed_at": "2022-10-30T04:39:42.029696Z",
            "updated_at": "2023-01-30T01:05:17.839503Z",
            "alias": "dev-collie-filebox",
            "secondary_alias": "filebox-1-q0603932",
            "micros": [
                {
                    "id": "1e935ba6-3ed6-4ce4-a1cf-fe37e27574cf",
                    "name": "api",
                    "app_instance_id": "c0crGHgsVM8C",
                    "presets": {
                        "env": [],
                        "memory": 0,
                        "timeout": 0,
                        "api_keys": true
                    },
                    "public_routes": null,
                    "path": "api",
                    "engine": "custom",
                    "url_version": "0"
                },
                {
                    "id": "5f8cf15f-1d50-4535-8a15-5839484b0255",
                    "name": "router",
                    "app_instance_id": "c0crGHgsVM8C",
                    "presets": {
                        "env": [],
                        "memory": 0,
                        "timeout": 0,
                        "api_keys": false
                    },
                    "public_routes": null,
                    "path": "/",
                    "engine": "custom",
                    "url_version": "0"
                }
            ],
            "url": "https://filebox-1-q0603932.deta.app",
            "legacy_url": "https://dev-collie-filebox.gyrooo.deta.app",
            "update": {
                "available": false
            },
            "api_keys": null,
            "keys": null,
            "migrated": false
        },
        {
            "id": "c0pGWD7URARD",
            "app_id": "c0bDN2geJG7p",
            "installation_id": "d745d4da-da83-4063-8714-1c4ade7c27af",
            "installation": {
                "id": "d745d4da-da83-4063-8714-1c4ade7c27af",
                "app_id": "c0bDN2geJG7p",
                "release_id": "11553cdc-624d-437c-a0a3-bc6456cbd95f",
                "instance_id": "",
                "created_at": "2022-12-19T16:31:41.5095Z",
                "updated_at": "2022-12-19T16:31:41.5095Z",
                "status": "complete",
                "is_update": false
            },
            "release": {
                "id": "11553cdc-624d-437c-a0a3-bc6456cbd95f",
                "name": "rustserver-dev-PAnU",
                "app_name": "rust-server",
                "short_description": "",
                "release_alias": "rustserver",
                "version": "dev-PAnU",
                "channel": "development",
                "icon_url": "",
                "app_id": "c0bDN2geJG7p",
                "released_at": "2022-12-19T16:31:38.310432Z",
                "status": "active",
                "latest": true,
                "author": "",
                "notes": "",
                "app_promotion_id": {
                    "String": "11553cdc-624d-437c-a0a3-bc6456cbd95f",
                    "Valid": true
                },
                "micros": null,
                "placeholder_icon_config": {
                    "css_background": "background-color: hsl(58, 100%, 80%); background-image: radial-gradient(at 44% 11%, hsl(58, 100%, 80%) 0px, transparent 50%),radial-gradient(at 36% 92%, hsl(58, 100%, 76%) 0px, transparent 50%),radial-gradient(at 5% 61%, hsl(28, 100%, 75%) 0px, transparent 50%),radial-gradient(at 26% 99%, hsl(208, 100%, 79%) 0px, transparent 50%),radial-gradient(at 78% 65%, hsl(-92, 100%, 71%) 0px, transparent 50%),radial-gradient(at 32% 26%, hsl(208, 100%, 82%) 0px, transparent 50%);"
                },
                "revision": {
                    "id": "7fa42671-bf4a-4313-ae42-ac459e83b18a",
                    "tag": "quetzal-mawh",
                    "app_id": "c0bDN2geJG7p",
                    "app_name": "",
                    "created_at": "2022-12-19T16:31:38.300547Z",
                    "updated_at": "2022-12-19T16:31:38.300547Z"
                }
            },
            "installed_at": "2022-12-19T16:31:41.522231Z",
            "updated_at": "2022-12-19T16:31:41.522231Z",
            "alias": "dev-mullet-rustserver",
            "secondary_alias": "rustserver-1-o3535015",
            "micros": [
                {
                    "id": "de92aebf-1244-4cb6-a340-c8cbcb342148",
                    "name": "api",
                    "app_instance_id": "c0pGWD7URARD",
                    "presets": {
                        "env": [],
                        "memory": 0,
                        "timeout": 0,
                        "api_keys": false
                    },
                    "public_routes": null,
                    "path": "/",
                    "engine": "custom",
                    "url_version": "0"
                }
            ],
            "url": "https://rustserver-1-o3535015.deta.app",
            "legacy_url": "https://dev-mullet-rustserver.gyrooo.deta.app",
            "update": {
                "available": false
            },
            "api_keys": null,
            "keys": null,
            "migrated": false
        },
        {
            "id": "c0LK6PZ5vuaB",
            "app_id": "ebf93464-fbc4-4a13-ae67-85ba912dda22",
            "installation_id": "bb4861f1-a3f6-4667-ade4-6af9d606dff5",
            "installation": {
                "id": "bb4861f1-a3f6-4667-ade4-6af9d606dff5",
                "app_id": "ebf93464-fbc4-4a13-ae67-85ba912dda22",
                "release_id": "y53qrbz4ijiife5t",
                "instance_id": "",
                "created_at": "2023-01-30T01:23:51.470059Z",
                "updated_at": "2023-01-30T01:23:51.470059Z",
                "status": "complete",
                "is_update": false
            },
            "release": {
                "id": "y53qrbz4ijiife5t",
                "name": "filebox-v2.2.2",
                "app_name": "filebox",
                "short_description": "",
                "release_alias": "filebox",
                "version": "v2.2.2",
                "channel": "experimental",
                "icon_url": "https://s3.eu-central-1.amazonaws.com/deta-app-icons.144798365827.eu-central-1/80f21279-3b96-4520-893b-18f0567add76/icons/icon",
                "app_id": "ebf93464-fbc4-4a13-ae67-85ba912dda22",
                "released_at": "2023-01-30T01:11:33.086967Z",
                "status": "active",
                "latest": true,
                "author": "",
                "notes": "",
                "app_promotion_id": {
                    "String": "y53qrbz4ijiife5t",
                    "Valid": true
                },
                "micros": null,
                "placeholder_icon_config": {
                    "css_background": "background-color: hsl(44, 100%, 80%); background-image: radial-gradient(at 32% 88%, hsl(44, 100%, 80%) 0px, transparent 50%),radial-gradient(at 60% 2%, hsl(44, 100%, 76%) 0px, transparent 50%),radial-gradient(at 98% 67%, hsl(14, 100%, 75%) 0px, transparent 50%),radial-gradient(at 58% 69%, hsl(194, 100%, 79%) 0px, transparent 50%),radial-gradient(at 7% 40%, hsl(-106, 100%, 71%) 0px, transparent 50%),radial-gradient(at 72% 94%, hsl(194, 100%, 82%) 0px, transparent 50%);"
                }
            },
            "installed_at": "2023-01-30T01:23:51.515922Z",
            "updated_at": "2023-01-30T01:23:51.515922Z",
            "alias": "filebox-2-q0603932",
            "secondary_alias": "filebox-2-q0603932",
            "micros": [
                {
                    "id": "b3c86f2e-cf10-4fa1-ae5b-1a294e411cc1",
                    "name": "api",
                    "app_instance_id": "c0LK6PZ5vuaB",
                    "presets": {
                        "env": [],
                        "memory": 0,
                        "timeout": 0,
                        "api_keys": true
                    },
                    "public_routes": null,
                    "path": "api",
                    "engine": "custom",
                    "url_version": "1"
                },
                {
                    "id": "979a2a0b-66a1-4354-a298-ba5f219adb44",
                    "name": "router",
                    "app_instance_id": "c0LK6PZ5vuaB",
                    "presets": {
                        "env": [],
                        "memory": 0,
                        "timeout": 0,
                        "api_keys": false
                    },
                    "public_routes": null,
                    "path": "/",
                    "engine": "custom",
                    "url_version": "1"
                }
            ],
            "url": "https://filebox-2-q0603932.deta.app",
            "update": {
                "available": false
            },
            "api_keys": null,
            "keys": null,
            "migrated": false
        }
    ],
    "page": {
        "size": 5
    }
}