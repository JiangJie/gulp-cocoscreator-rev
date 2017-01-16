'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const gutil = require('gulp-util');

const mkdirp = require('mkdirp');
const copydir = require('copy-dir');

module.exports = ({
    src,
    dest,
    settingsDest
} = {}) => {
    return () => {
        if (!src || !dest || !settingsDest) return Promise.reject(new Error('缺少参数'));

        // 资源存放路径
        const rawPath = `${src}/res/raw-`;
        // json存放路径
        const importPath = `${src}/res/import`;
        // setting.js文件路径
        const settingsPath = `${src}/src/settings.js`;

        // 资源md5前后的一个map
        const assetsMap = {};

        // 将资源存放到新的文件夹
        function mkWebPath(path) {
            const _path = path.split('/res/');
            _path[0] = dest;
            return _path.join('/res/');
        }

        function handleAssets({
            rawAssets
        }) {
            gutil.log('\x1B[32m[MD5 ASSETS] start...\x1B[0m');

            Object.entries(rawAssets).forEach(([raw, assets]) => {
                const dir = rawPath + raw;

                Object.entries(assets).forEach(([_, asset]) => {
                    try {
                        const [file] = asset;

                        const data = fs.readFileSync(`${dir}/${file}`);
                        const hash = crypto.createHash('md5');

                        let md5 = hash.update(data).digest('hex');
                        // 资源去重
                        if (md5 in assets) {
                            delete assets[_];
                            assetsMap[_] = md5;
                            return;
                        }

                        // md5 in assets && (md5 += `-${crypto.createHash('md5').update(String(Date.now() + Math.random())).digest('hex').slice(0, 5)}`);
                        const _md5 = md5.slice(0, 5);

                        const i = file.lastIndexOf('.');
                        const newFile = ~i ? `${file.slice(0, i)}.${_md5}${file.slice(i)}` : `${file}.${_md5}`;
                        // 新文件放到web文件夹下
                        // 不对build产生负作用，可重复跑gulp任务
                        let webFile = `${mkWebPath(dir)}/${newFile}`;

                        try {
                            mkdirp.sync(path.dirname(webFile));
                            fs.writeFileSync(webFile, data);
                            asset[0] = newFile;
                            assets[md5] = assets[_];
                            delete assets[_];
                            assetsMap[_] = md5;
                        } catch (err) {
                            gutil.log(`\x1B[31m[MD5 ASSETS] write file error: ${err.message}\x1B[0m`);
                        }
                    } catch (err) {
                        // gutil.log(`\x1B[31m[MD5 ASSETS] read file error: ${err.message}\x1B[0m`);
                    }
                });
            });

            gutil.log('\x1B[32m[MD5 ASSETS] all done!\x1B[0m');
        }

        function handleJson({
            rawAssets,
            packedAssets
        }) {
            gutil.log('\x1B[32m[MD5 JSON] start...\x1B[0m');

            const uuids = Object.keys(packedAssets);
            const assetsUuids = [];

            // 以下两段有重叠

            const whiteList = Object.entries(packedAssets).reduce((ret, [_, assets]) => {
                ret = new Set([...ret, ...assets]);
                return ret;
            }, new Set());

            Object.entries(rawAssets).forEach(([_, assets]) => {
                // 需要特殊处理
                // prefab文件和没有后缀名的玩意需要处理
                Object.entries(assets).forEach(([uuid]) => uuid.split('-').length > 2 && !whiteList.has(uuid) && assetsUuids.push(uuid));
            });

            function isDir(uuid) {
                const dir = `${importPath}/${uuid.slice(0, 2)}/${uuid}`;
                try {
                    const stat = fs.statSync(dir);
                    return stat.isDirectory();
                } catch (err) {
                    return false;
                }
            }

            function md5Dir(dir) {
                const hash = crypto.createHash('md5');
                const files = fs.readdirSync(dir);

                files.forEach(file => {
                    const data = fs.readFileSync(`${dir}/${file}`);
                    hash.update(data);
                });
                return hash.digest('hex');
            }

            const map = {};
            // const _map = {};

            function handle(_uuids) {
                _uuids.forEach(uuid => {
                    // if(map[uuid]) return;

                    // if(_map[uuid]) gutil.log(`\x1B[31m[MD5 JSON] ${uuid} ${map[uuid]} loop\x1B[0m`);
                    // _map[uuid] = 1;

                    const dir = `${importPath}/${uuid.slice(0, 2)}/${uuid}`;

                    // 新增对字体文件夹处理
                    if (isDir(uuid)) {
                        let md5 = md5Dir(dir);
                        // md5 = md5.slice(0, 5);
                        // const newUuid = `${uuid}.${md5}`;
                        const newUuid = md5;
                        // const newDir = mkWebPath(`${dir}.${md5}`);
                        const newDir = mkWebPath(`${importPath}/${newUuid.slice(0, 2)}/${newUuid}`);

                        try {
                            mkdirp.sync(newDir);
                            copydir.sync(dir, newDir, (stat, filepath) => stat === 'file' && path.extname(filepath) === '.fnt');
                            // gutil.log(`\x1B[32m[MD5 JSON] rename dir success: ${newDir}\x1B[0m`);
                            map[uuid] = newUuid;
                        } catch (err) {
                            gutil.log(`\x1B[31m[MD5 JSON] rename dir error: ${err.message}\x1B[0m`);
                        }
                    } else {
                        try {
                            const file = `${dir}.json`;
                            let data = fs.readFileSync(file, {
                                encoding: 'utf8'
                            });

                            function save() {
                                const hash = crypto.createHash('md5');
                                const md5 = hash.update(data).digest('hex');

                                // 由于packedAssets每次build都会生成全新的UUID，不管内容有没有变
                                // 优化：使用md5作为新的UUID，这样就保证没改变就不更新
                                // `${uuid}.${md5.slice(0, 5)}`;
                                const newUuid = md5;

                                let newFile = `${importPath}/${newUuid.slice(0, 2)}/${newUuid}.json`;
                                newFile = mkWebPath(newFile);

                                // 再替换一次自身
                                data = data.replace(new RegExp(uuid, 'g'), newUuid);

                                try {
                                    mkdirp.sync(path.dirname(newFile));
                                    fs.writeFileSync(newFile, data);
                                    // gutil.log(`\x1B[32m[MD5 JSON] write new file success: ${newFile}\x1B[0m`);
                                    map[uuid] = newUuid;
                                } catch (err) {
                                    gutil.log(`\x1B[31m[MD5 JSON] write file error: ${err.message}\x1B[0m`);
                                }
                            }

                            let mUuids = data.match(/"[0-9a-f]{8,9}(-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?"/g) || [];
                            mUuids = mUuids.map(item => item.slice(1, item.length - 1));

                            // 这一步一定不能少
                            uuids.includes(uuid) && (mUuids = mUuids.concat(packedAssets[uuid]));

                            // 去重
                            mUuids = new Set(mUuids);
                            mUuids = [...mUuids];

                            // 只处理没处理过的
                            // 避免死循环，不处理自身
                            const _mUuids = mUuids.filter(_uuid => !map[_uuid] && !assetsMap[_uuid] && _uuid !== uuid && (isDir(_uuid) || !whiteList.has(_uuid)));

                            handle(_mUuids);

                            mUuids.forEach(_uuid => {
                                const __uuid = map[_uuid] || assetsMap[_uuid];
                                __uuid && _uuid !== __uuid && (data = data.replace(new RegExp(_uuid, 'g'), __uuid));
                            });

                            // 对packed json进行排序
                            if (uuids.includes(uuid)) {
                                const _uuids = packedAssets[uuid];
                                const packedMap = _uuids.reduce((ret, item, i) => {
                                    const _item = map[item] || assetsMap[item];
                                    _item && _item !== item && (item = _uuids[i] = _item);

                                    ret[item] = i;
                                    return ret;
                                }, {});

                                _uuids.sort();

                                data = JSON.parse(data);

                                // 同步调整顺序
                                data = _uuids.map(uuid => data[packedMap[uuid]]);
                                data = JSON.stringify(data);
                            }

                            save();
                        } catch (err) {
                            gutil.log(`\x1B[31m[MD5 JSON] read file error: ${err.message}\x1B[0m`);
                            // map[uuid] || (map[uuid] = uuid);
                        }
                    }
                });
            }

            handle(uuids);

            const _assetsUuids = assetsUuids.filter(uuid => !map[uuid]);
            // gutil.log('[MD5 JSON] _assetsUuids', _assetsUuids);
            handle(_assetsUuids);

            // gutil.log('[MD5 JSON] map', map);

            uuids.forEach(uuid => {
                if (!map[uuid] || map[uuid] === uuid) return;

                const assets = packedAssets[uuid];
                // assets.forEach((uuid, i) => {
                //     if(!map[uuid] || map[uuid] === uuid) return;

                //     // 一定要保证数组顺序不变
                //     assets[i] = map[uuid];
                // });

                packedAssets[map[uuid]] = [...assets];
                delete packedAssets[uuid];
            });

            assetsUuids.forEach(uuid => {
                if (!map[uuid] || map[uuid] === uuid) return;
                rawAssets.assets[map[uuid]] = rawAssets.assets[uuid];
                delete rawAssets.assets[uuid];
            });

            gutil.log('\x1B[32m[MD5 JSON] all done!\x1B[0m');
        }

        function sortAssets({
            rawAssets
        }) {
            Object.entries(rawAssets).forEach(([_, assets]) => {
                rawAssets[_] = Object.keys(assets).sort().reduce((ret, key) => {
                    ret[key] = assets[key];
                    return ret;
                }, {});
            });
        }

        function sortJson(settings) {
            const {
                packedAssets
            } = settings;

            settings.packedAssets = Object.keys(packedAssets).sort().reduce((ret, key) => {
                // 这里顺序一定要和json的内容保持一致
                // packedAssets[key].sort();
                ret[key] = packedAssets[key];
                return ret;
            }, {});
        }

        return new Promise(resolve => {
            const prefix = '_CCSettings';

            let settings = fs.readFileSync(settingsPath, {
                encoding: 'utf8'
            });
            settings = settings.replace(new RegExp(`^${prefix}\s*=\s*`), '').replace(/;\s*$/, '');
            settings = JSON.parse(settings);

            handleAssets(settings);
            handleJson(settings);

            sortAssets(settings);
            sortJson(settings);

            fs.writeFileSync(settingsDest, `${prefix} = ${JSON.stringify(settings, null, 4).replace(/"([a-zA-Z]+)":/gm, '$1:')}`);

            resolve();
        });
    };
};
