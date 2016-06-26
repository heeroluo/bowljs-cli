/*!
 * Command line tools for Bowljs
 * Document comment parser (2016-06-25T17:35:32+0800)
 * http://jraiser.org/ | Released under LGPL license
 */

'use strict';

var path = require('path'),
	console = require('./console'),
	util = require('./util'),
	File = require('./file'),
	docMember = require('./doc-member');


// 为目标添加特性
function addFeature(target, feature) {
	target.$features = target.$features || [ ];
	target.$features.push(feature);
}

var re_brace = /^\s*\{(.*?)\}\s*/;

// 各种标签的解析器
// 一定要带上“@”，否则有些标签名跟关键字或保留字一样，会导致结果异常
var tagParsers = {
	// 模块
	'@module': function(obj, content) {
		obj.$name = content;
		obj.$tag = 'module';
	},
	// 模块分类
	'@category': function(obj, content) {
		if (obj.$tag === 'module') { obj.$category = content; }
	},
	// 导入其他模块的文档
	'@includeFor': function(obj, content) {
		var $type = '';
		content = content.replace(re_brace, function(match, $1) {
			$type = $1;
			return '';
		});
		obj.$include = {
			$for: $type,
			$list: content.replace(/[\r\n]+/g, '').split(/\s*,\s*/)
		};
	},
	// 忽略生成此模块的文档
	'@ignore': function(obj, content) { obj.$ignore = true; },
	// 文档指向外部链接
	'@see': function(obj, content) { obj.$see = content; },

	// 描述
	'': function(obj, content) { obj.$description = content; },
	// 所属
	'@for': function(obj, content) { obj.$for = content; },

	// 类型
	'@class': function(obj, content) {
		obj.$name = content;
		obj.$tag = 'class';
	},
	// 继承
	'@extends': function(obj, content) { obj.$extends = content; },
	// 构造函数
	'@constructor': function(obj, content) {
		if (obj.$tag === 'class') {
			obj.$constructor = true;
		} else {
			obj.$tag = 'constructor';
		}
	},
	// 方法
	'@method': function(obj, content) {
		obj.$name = content;
		obj.$tag = 'method';
	},
	// 属性
	'@property': function(obj, content) {
		obj.$name = content;
		obj.$tag = 'property';
	},

	// 类型
	'@type': function(obj, content) {
		obj.$type = content.replace(re_brace, '$1');
	},
	// 返回值
	'@return': function(obj, content) {
		var $type;
		content = content.replace(re_brace, function(match, $1) {
			$type = $1;
			return '';
		});

		obj.$return = {
			$type: $type,
			$description: content
		};
	},
	// 函数参数
	'@param': function(obj, content) {
		var $type = '', name = '', optional = false, defaultValue = '';

		content = content.replace(re_brace, function(match, $1) {
			$type = $1;
			return '';
		}).replace(
			content.charAt(0) === '[' ? /(\[.+?\])\s+/ : /(.+?)\s+/,
			function(match, $1) {
				name = $1;
				return '';
			}
		);

		name = name
			.replace(/^\[(.*?)\]/, function(match, $1) {
				optional = true;
				return $1;
			})	// 是否可选参数
			.replace(/=(.*)$/, function(match, $1) {
				defaultValue = $1;
				return '';
			})	// 匹配默认值
			.split('.');

		var parent = obj;
		// 处理多级参数，如 options.data
		name.every(function(s, i) {
			var n = name.slice(0, i + 1).join('.'),
				params = parent.$params = parent.$params || [ ];

			if (i === name.length - 1) {
				var wholeName = n;
				if (defaultValue) {
					wholeName += '=' + defaultValue;
				}
				if (optional) {
					wholeName = '[' + wholeName + ']';
				}
				params.push({
					$name: n,
					$type: $type,
					$description: content,
					$optional: optional,
					$default: defaultValue,
					$wholeName: wholeName
				});
			} else {
				var param;
				params.every(function(p) {
					if (p.$name === n) { param = p; }
					return param == null;
				});
				if (param) {
					parent = param;
					return true;
				} else {
					// 父层级参数不存在，停止循环
					return false;
				}
			}
		});
	},
	// 事件
	'@event': function(obj, content) {
		obj.$tag = 'event';
		obj.$name = content;
	}
};

// 解析注释中的文档内容
function parseComment(content) {
	// 匹配出文档注释
	var comments = content.match(/\/\*\*[\w\W]+?\*\//g);

	if (!comments) { return; }

	// 匹配行首的标签
	var rTag = /^(@\w+)(?:$|\s)/mg;

	// 模块解析结果
	var module;

	// 中间解析结果
	var tmpResult = [ ];

	// 逐个注释块进行处理
	comments.forEach(function(comment) {
		comment = comment
			.replace(/^\/\*\*[\s\r\n]+/, '')	// 移除 /**
			.replace(/[\s\r\n]+\*\/$/, '')		// 移除 */
			.replace(/^\s*\*\s*/mg, '');		// 移除行首的*

		// 存放单个注释块的解析结果
		var thisBlock = { };

		// 循环匹配标签，截取开始位置到下一个标签前的字符为当前标签说明
		var pos = 0, tag = '', nextTag;
		while ( rTag.test(comment) ) {
			nextTag = RegExp.$1;

			if (tagParsers[tag]) {
				tagParsers[tag](
					thisBlock,
					comment.substring(pos, rTag.lastIndex - RegExp.lastMatch.length).trim()
				);
			} else {
				addFeature( thisBlock, tag.substr(1) );
			}

			// 下一个标签及开始位置
			tag = nextTag;
			pos = rTag.lastIndex;
		}
		if (tagParsers[tag]) {
			tagParsers[tag]( thisBlock, comment.substr(pos).trim() );
		} else {
			addFeature( thisBlock, tag.substr(1) );
		}

		if (thisBlock.$tag === 'module') {
			// 此注释块为模块说明
			module = thisBlock;
		} else {
			tmpResult.push(thisBlock);
			// 把构造函数从类注释块中分离出来
			if (thisBlock.$constructor) {
				tmpResult.push({
					$tag: 'constructor',
					$params: thisBlock.$params,
					$for: thisBlock.$name
				});
				delete thisBlock.$params;
				delete thisBlock.$constructor;
			}
		}
	});

	if (module) {
		module = new docMember.$Module(module);
		tmpResult.forEach(function(obj) { module.createMember(obj); });
		module.$savePath = module.$name.replace(/\W/g, '_');
	}

	return module;
}

// 解析单个文件的注释
function parseFile(p) {
	var file = new File(p);
	if ( !file.exists() ) { return; }

	var content;
	try {
		content = file.read();
	} catch(e) {
		console.warn(e.message);
	}
	if (!content) { return; }

	var module = parseComment(content);
	if (module) { module.$path = file.path(); }

	return module;
}


// 解析目录中所有文件的注释
exports.parseDoc = function(inputPath, settings) {
	// 存放所有解析后的模块
	var allModules = { };
	// 按分类存放解析后的模块
	var allModulesByCategory = { };
	// 存放需导入外部注释的模块
	var incompleteModules = [ ];

	File.eachFile(
		inputPath, function(p) {
			// 不解析非debug文件
			if ( !/-debug\.js$/.test(p) ) { return; }

			var module = parseFile(p);
			if (!module) { return; }
			allModules[p] = module;

			// 忽略的模块不放到分类中
			if (module.$name && !module.$ignore) {
				var category = module.$category || '';
				category = allModulesByCategory[category] = allModulesByCategory[category] || [ ] ;
				category.push(module);
			}

			// 记录需要导入外部注释的模块
			// 在下一步中导入
			if (module.$include && module.$include.$list && module.$include.$for) {
				incompleteModules.push(module);
			}
		},
		settings.ignored_paths
	);

	// 处理需要导入外部文件注释的模块
	incompleteModules.forEach(function(module) {
		var $include = module.$include, targetMember = module.getMemberByName($include.$for);
		if (!targetMember) { return; }

		$include.$list.forEach(function(p) {
			var includedModule = allModules[path.resolve(path.dirname(module.$path) , p)];
			if (includedModule) {
				var parent = includedModule.getMemberByName($include.$for);
				if (!parent || !parent.$members) { return; }
				parent.$members.forEach(function(member) {
					member.appendTo(targetMember);
				});
			}
		});
	});

	function compare(a, b) {
		if (a > b) {
			return 1;
		} else if (a < b) {
			return -1;
		} else  {
			return 0;
		}
	}

	var result = [ ];
	for (var i in allModulesByCategory) {
		allModulesByCategory[i].sort(function(a, b) {
			return compare(a.$name, b.$name);
		});
		result.push({
			$category: i,
			$modules: allModulesByCategory[i]
		});
	}
	// 分类排序
	var categorySort;
	if (settings.category_order) {
		categorySort = function(a, b) {
			return compare(
				settings.category_order.indexOf(a.$category),
				settings.category_order.indexOf(b.$category)
			);
		};
	} else {
		categorySort = function(a, b) {
			return compare(a.$category, b.$category);
		};
	}

	result.sort(categorySort);

	return result;
};


// 创建文档文件
function createDocFiles(data, tplPath, outputPath) {
	var ejs = require('ejs'), fs = require('fs'), htmlMinifier = require('html-minifier');;

	// 读取目录页模版
	var tpl = new File( path.join(tplPath, 'index.tpl') );
	if ( !tpl.exists() ) { return; }
	tpl = tpl.read();

	// 生成目录页
	fs.writeFileSync(
		path.join(outputPath, 'index.html'),
		htmlMinifier.minify(
			ejs.render(tpl, {
				data: data,
				currentYear: (new Date).getFullYear()
			}),
			{ removeComments: true, collapseWhitespace: true }
		),
		'utf8'
	);

	// 读取模块模版
	tpl = new File( path.join(tplPath, 'module.tpl') );
	if ( !tpl.exists() ) { return; }
	tpl = tpl.read();

	outputPath = path.join(outputPath, 'modules');
	if ( !fs.existsSync(outputPath) ) { fs.mkdirSync(outputPath); }

	// 逐个模块循环生成
	data.forEach(function(byCategory) {
		byCategory.$modules.forEach(function(module) {
			if (!module.$name || module.$see) { return; }

			var modulePath = path.join(outputPath, module.$savePath);
			if ( !fs.existsSync(modulePath) ) { fs.mkdirSync(modulePath); }

			fs.writeFileSync(
				path.join(modulePath, 'index.html'),
				htmlMinifier.minify(
					ejs.render(tpl, {
						data: data,
						parent: { },
						current: module
					}),
					{ removeComments: true, collapseWhitespace: true }
				),
				'utf8'
			);

			if (module.$classes) {
				module.$classes.forEach(function(cls) {
					fs.writeFileSync(
						path.join(modulePath, cls.$name + '.html'),
						htmlMinifier.minify(
							ejs.render(tpl, {
								data: data,
								parent: module,
								current: cls
							}),
							{ removeComments: true, collapseWhitespace: true }
						),
						'utf8'
					);
				});
			}
		});
	});
}

// 创建文档
exports.createDoc = function(data, settings, callback) {
	var tplPath = settings.template_path, outputPath = settings.output_path;

	console.info('generating documents to {{' + outputPath + '}}');

	// 复制非模版文件
	var ncp = require('ncp').ncp;
	ncp(tplPath, outputPath, {
		filter: function(filename) {
			return path.extname(filename).toLowerCase() !== '.tpl';
		}
	}, function(err) {
		if (!err) { createDocFiles(data, tplPath, outputPath); }
		if (callback) { callback(err); }
	});
};