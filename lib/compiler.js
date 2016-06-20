/*!
 * Command line tools for Bowljs
 * Compiler (2016-06-20T10:00:29+0800)
 * http://jraiser.org/ | Released under LGPL license
 */

'use strict';

var path = require('path'),
	File = require('./file'),
	util = require('./util');


// 检查是否绝对路径
function isAbsPath(path) { return /^(?:[a-z]+:)?\/{2,}/i.test(path); }


// 文件路径转换为模块id
var toModuleId = exports.toModuleId = function(p, settings) {
	var basePath, moduleId;

	if (settings) {
		var pos1 = util.iIndexOf(p, settings.lib_path),
			pos2 = util.iIndexOf(p, settings.app_path);

		if (pos1 === 0 && pos2 === 0) {
			// 类库路径与应用路径一样，或为上下级目录的情况下
			// 优先使用层级更深的路径
			basePath = settings.lib_path.length >= settings.app_path.length ?
				settings.lib_path : settings.app_path;
		} else if (pos1 === 0) {
			basePath = settings.lib_path;
		} else if (pos2 === 0) {
			basePath = settings.app_path;
		}
	}

	if (basePath) {
		moduleId = basePath === settings.app_path ? '/' : '';
		moduleId += util.iReplace(p, basePath, '');
	} else {
		moduleId = p;
	}
	// 统一替换正反斜杠为正斜杠
	moduleId = moduleId.split(path.sep).join('/');

	var re_jsFile = /\.js$/i;
	if ( re_jsFile.test(moduleId) ) {
		// 精简id
		moduleId = moduleId
			// 移除默认的.js扩展名
			.replace(re_jsFile, '')
			// 移除调试后缀
			.replace(/-debug$/i, '')
			// 移除目录下的默认文件名
			.replace(/\/index$/i, '/');
	} else {
		// 移除调试后缀，但非.js文件要保留扩展名
		moduleId = moduleId.replace(/-debug(\.[^.]+)$/i, '$1');
	}

	return moduleId;
};

// 模块id转换为文件路径
var toModulePath = exports.toModulePath = function(from, to, settings) {
	if (settings) {
		if ( /^[\\\/]/.test(to) ) {
			// 以斜杠开头的路径，参考路径为应用路径
			from = settings.app_path;
			to = to.substr(1);
		} else if ( !/^\./.test(to) ) {
			// 非相对路径情况下，参考路径为类库路径
			from = settings.lib_path;
		}
	}

	// 解析 module@version 为 module/version/module
	to = to.replace(/([^\\\/]+)@([^\\\/]+)/g, function(match, module, version) {
		return module + '/' + version + '/' + module;
	});

	var result = path.resolve(from, to);
	// to为目录的情况下，要在末尾补上分隔符
	if ( /[\\\/]$/.test(to) ) { result = util.addPathSepToEnd(result); }

	return result;
};

// 根据调试符号转换文件路径
var convertPath = exports.convertPath = function(filePath, isDebug) {
	if ( /[\\\/]+$/.test(filePath) ) {
		// 目录的默认文档为index
		filePath += 'index';
	}

	var extname = path.extname(filePath), basename = path.basename(filePath, extname);

	// 根据是否调试，确定文件名是否需要加-debug
	var re_debug = /-debug$/i;
	if (isDebug) {
		if ( !re_debug.test(basename) ) { basename += '-debug'; }
	} else {
		basename = basename.replace(re_debug, '');
	}

	if (!extname) { extname = '.js'; }

	return path.join(path.dirname(filePath), basename + extname);
};


// 带缓存的文件内容加载器
var fileReader = {
	_cache: { },

	read: function(p) {
		var cache = this._cache;
		if (!cache[p]) {
			var file = new File(p), content;
			if ( file.exists() ) {
				content = file.read();
			} else {
				throw new Error('{{' + p + '}} does not exist');
			}
			cache[p] = content;
		}
		return cache[p];
	}
};


// 带缓存的深度依赖分析器
var depsParser = {
	_cache: { },

	// 被依赖模块是否需要合并到依赖方
	_needCombine: function(moduleId, depId, settings) {
		if ( !settings || isAbsPath(depId) ) { return false; }

		var included = false;
		if (settings.include_subs) {
			included = depId.indexOf( moduleId.replace(/\/[^\/]+$/, '/') ) === 0;
		}

		var myRules;
		if (settings.list) {
			myRules = settings.list.filter(function(rule) {
				return rule.target.test(moduleId);
			});
			if (!myRules.length) { myRules = null; }
		}

		if (myRules) {
			return myRules.some(function(rule) {
				var subResult = included;

				if (!subResult) {
					if (rule.includes) {
						subResult = rule.includes.some(function(inc) {
							return inc.test(depId);
						});
					} else {
						subResult = true;
					}
				}
				if (subResult && rule.excepts) {
					subResult = rule.excepts.every(function(except) {
						return !except.test(depId);
					});
				}

				return subResult;
			});
		} else {
			return included;
		}
	},

	// 从代码中提取直接依赖项
	_parseFromCode: function(code) {
		var pattern = /(?:^|[^.$])\brequire\s*\(\s*(["'])([^"'\s\)]+)\1\s*\)/g,
			result = [ ],
			match;

		code = code
			.replace(/^\s*\/\*[\s\S]*?\*\/\s*$/mg, '') 	// 多行注释
	        .replace(/^\s*\/\/.*$/mg, '');				// 单行注释

		while ( match = pattern.exec(code) ) {
			if (match[2]) { result.push(match[2]); }
		}

		return result.length ? util.literalUnique(result) : null;
	},

	// 根据配置对象深度获取依赖
	_parseAllWithSettings: function(p, deps, settings) {
		var t = this, moduleId = toModuleId(p, settings), result = [ ];

		deps.forEach(function(dep, i) {
			if ( isAbsPath(dep) ) {
				result.push({
					id: dep,
					path: dep,
					combined: false
				});
				return;
			}

			var depPath = toModulePath(path.dirname(p), dep, settings),
				depObj = {
					id: toModuleId(depPath, settings),
					path: convertPath(depPath, true)
				};

			depObj.combined = t._needCombine(moduleId, depObj.id, settings);

			// 递归获取依赖的依赖
			var subResult = t.parse(depObj.path, settings);

			// 合并到结果集
			if (subResult) {
				subResult.forEach(function(depObj) {
					result.push({
						id: depObj.id,
						path: depObj.path,
						combined: t._needCombine(moduleId, depObj.id, settings)
					});
				});
			}

			// 记录模块信息到结果集
			result.push(depObj);
		});

		result = util.literalUnique(result, 'id');

		// 获取不合并的模块
		var excepteds = result.filter(function(depObj) { return !depObj.combined; });

		if (excepteds.length) {
			// 获取不合并的模块所合并的模块
			var externals = excepteds.map(function(depObj) {
				var deps = t.parse(depObj.path), result = [ ];
				if (deps) {
					deps.forEach(function(depObj) {
						if (depObj.combined && !depObj.external) {
							result.push(depObj.id)
						}
					});
				}
				return result;
			});

			var i, j;

			// 检查不合并的模块之间有没有相互合并关系
			for (i = excepteds.length - 1; i >= 0; i--) {
				for (j = excepteds.length - 1; j >= 0; j--) {
					if (i !== j && !excepteds[j].external) {
						if (externals[j].indexOf(excepteds[i].id) !== -1) {
							excepteds[i].external = excepteds[j].id;
							break;
						}
					}
				}
			}

			// 检查合并的模块是否已合并到外部文件中，以免重复合并
			for (i = result.length - 1; i >= 0; i--) {
				if (result[i].combined && !result[i].external) {
					for (j = 0; j < excepteds.length; j++) {
						if (!excepteds[j].external) {
							if (externals[j].indexOf(result[i].id) !== -1) {
								result[i].external = excepteds[j].id;
								break;
							}
						}
					}
				}
			}
		}

		return result;
	},

	// 解析依赖
	parse: function(p, settings) {
		if ( isAbsPath(p) ) { return; }

		var cache = this._cache;
		if ( !cache.hasOwnProperty(p) ) {
			var deps = this._parseFromCode( fileReader.read(p) ), result;
			if (deps) {
				if (settings) {
					result = this._parseAllWithSettings(p, deps, settings);
				} else {
					result = deps.map(function(dep) { return { id: dep }; });
				}
				if (!result.length) { result = null; }
			}
			cache[p] = result;
		}
		return cache[p];
	}
};


// 带缓存的模块编译器
var compiler = {
	_cache: { },

	_compileCode: function(code, allDeps, id, uglify_options) {
		var result = require('uglify-js').minify(code, {
			fromString: true,
			output: uglify_options
		}).code;

		result = result.replace(/^\s*(define\()(function\()/m, function(match, $1, $2) {
			var params = [ ];
			if (id != null) { params.push( JSON.stringify(id) ); }
			if (params.length || allDeps) {
				params.push( allDeps ? JSON.stringify(allDeps) : 'null' );
			}
			params.push($2);

			return $1 + params.join(',');
		});

		// 标准化换行符
		return result.replace(/\r\n?/g, '\n');
	},

	compile: function(filePath, deps, id, settings) {
		// 以 路径<依赖项> 为缓存键名
		var key = filePath;
		if (deps) { key += '<' + deps.join('') + '>'; }

		var cache = this._cache;
		if ( !cache.hasOwnProperty(key) ) {
			cache[key] = this._compileCode(
				fileReader.read(filePath),
				deps,
				settings ? toModuleId(filePath, settings) : id,
				settings ? settings.uglify_options : null
			);
		}

		return cache[key];
	}
};


// 执行编译
exports.exec = function(filePath, settings) {
	var allDeps = depsParser.parse(filePath, settings), result = [ ];

	var requiredDeps = [ ];
	if (allDeps) {
		allDeps.forEach(function(depObj) {
			if (!depObj.external) {
				if (depObj.combined) {
					// 需要合并的模块
					result.push( compiler.compile(depObj.path, null, depObj.id, settings) );
				} else {
					requiredDeps.push(depObj.id);
				}
			}
		});
	}

	if (!requiredDeps.length) { requiredDeps = null; }

	result.push( compiler.compile(filePath, requiredDeps, null, settings) );

	return result.join('\n');
};