/*!
 * Command line tools for Bowljs
 * Package exports (2016-06-20T09:51:47+0800)
 * http://jraiser.org/ | Released under LGPL license
 */

'use strict';

var path = require('path'),
	fs = require('fs'),
	util = require('./lib/util'),
	console = require('./lib/console'),
	File = require('./lib/file');


// 从字符串新建正则表达式
function mapToRegExp(str) { return new RegExp(str); }


/**
 * 创建构建设置
 * @method makeBuildSettings
 * @param {Object} settings 设置项
 * @param {String} baseDir 基础目录
 * @return {Object} 编译设置
 */
var makeBuildSettings = exports.makeBuildSettings = function(settings, baseDir) {
	if (!settings) { return; }

	var result;

	// 引入外部配置
	if (settings['import']) {
		var file = new File( path.resolve(baseDir, settings['import']) );
		if ( file.exists() ) {
			result = makeBuildSettings( file.readAsJSON(), path.dirname( file.path() ) );
		} else {
			console.errorExit('"{{' + file.path() + '}}" does not exist');
		}
	}

	result = result || { };

	['lib_path', 'app_path'].forEach(function(pathName) {
		if (settings[pathName]) {
			result[pathName] = util.addPathSepToEnd( path.resolve(baseDir, settings[pathName]) );
		}
	});

	if (settings.ignored_paths) {
		result.ignored_paths = util.merge(
			result.ignored_paths || [ ],
			settings.ignored_paths.map(mapToRegExp)
		);
	}

	if ('include_subs' in settings) { result.include_subs = settings.include_subs; }

	if (settings.list) {
		result.list = util.merge(
			result.list || [ ],
			settings.list.map(function(item) {
				var config = {
					target: mapToRegExp(item.target)
				};
				if (item.includes) { config.includes = item.includes.map(mapToRegExp); }
				if (item.excepts) { config.excepts = item.excepts.map(mapToRegExp); }

				return config;
			})
		);
	}

	// UglifyJS配置项
	if (settings.uglify_options) {
		result.uglify_options = { };
		if (settings.uglify_options.comments) {
			result.uglify_options.comments = new RegExp(settings.uglify_options.comments);
		}
		result.uglify_options.ascii_only = Boolean(settings.uglify_options.ascii_only);
	}

	return result;
};


/**
 * 创建文档设置
 * @method makeDocSettings
 * @param {Object} settings 设置项
 * @param {String} baseDir 基础目录
 * @return {Object} 编译设置
 */
var makeDocSettings = exports.makeDocSettings = function(settings, baseDir) {
	if (!settings) { return; }

	var result = { }, templatePath = settings.template_path, outputPath = settings.output_path;

	if (templatePath && outputPath) {
		result.template_path = path.resolve(baseDir, templatePath);
		result.output_path = path.resolve(baseDir, outputPath);
	} else {
		console.errorExit('please specify {{template_path}} and {{output_path}} in the settings file');
	}

	if (settings.ignored_paths) {
		result.ignored_paths = settings.ignored_paths.map(mapToRegExp);
	}

	if (settings.category_order) {
		result.category_order = settings.category_order.slice();
	}

	return result;
};


/**
 * 构建
 * @method build
 * @param {String} inputPath 目标路径
 * @param {Object|String} settingsPath 编译配置对象或编译配置文件路径
 */
exports.build = function(inputPath, settingsPath) {
	var startTime = Date.now();

	inputPath = util.checkPath(inputPath, function() {
		console.errorExit('Please specify {{a file}} or {{a folder}} to build');
	});

	var settings;
	if (typeof settingsPath === 'object') {
		settings = settingsPath;
	} else {
		settingsPath = util.checkPath(settingsPath, function() {
			return path.resolve(inputPath, './package.settings');
		});
		// 加载配置文件
		var settingsFile = new File(settingsPath);
		if ( settingsFile.exists() ) {
			settings = settingsFile.readAsJSON();
			if (settings) {
				settings = makeBuildSettings( settings, path.dirname( settingsFile.path() ) );
			} else {
				console.errorExit('{{Invalid settings file}}');
			}
		}
	}

	if ( settings && !(settings.lib_path && settings.app_path) ) {
		console.errorExit('Please specify {{lib_path}} and {{app_path}} in the settings file');
	}

	var compiler = require('./lib/compiler');

	File.eachFile(
		inputPath, function(p) {
			// 不编译非debug文件
			if ( !/-debug\.[^.]+$/.test(p) ) { return; }

			var destination = compiler.convertPath(p, false);

			console.info('Building to {{' + destination + '}}');
			fs.writeFileSync(destination, compiler.exec(p, settings), 'utf8');
			console.log('Done');
		},
		(settings || { }).ignored_paths
	);

	console.info('Executed in {{' + (Date.now() - startTime) + 'ms}}');
};


/**
 * 生成文档
 * @method genDoc
 * @param {String} inputPath 目标路径
 * @param {Object|String} settingsPath 文档生成配置或文档生成配置文件路径
 */
exports.genDoc = function(inputPath, settingsPath) {
	var startTime = Date.now();

	var inputPath = util.checkPath(inputPath, function() {
		console.errorExit('Please specify the {{folder of source code}}');
	});

	var settings;
	if (typeof settingsPath === 'object') {
		settings = settingsPath;
	} else {
		settingsPath = util.checkPath(settingsPath, function() {
			return path.resolve(inputPath, './document.settings');
		});
		// 加载配置文件
		var settingsFile = new File(settingsPath), settings;
		if ( settingsFile.exists() ) {
			settings = settingsFile.readAsJSON();
			if (settings) {
				settings = makeDocSettings( settings, path.dirname( settingsFile.path() ) );
			} else {
				console.errorExit('{{Invalid settings file}}');
			}
		} else {
			console.errorExit('"{{' + settingsFile.path() + '}}" does not exists');
		}
	}

	if (!settings.template_path || !settings.output_path) {
		console.errorExit('Please specify {{template_path}} and {{output_path}} in the settings file');
	}

	var docParser = require('./lib/doc-parser');
	docParser.createDoc(docParser.parseDoc(inputPath, settings), settings, function(err) {
		if (err) {
			console.errorExit(err.message);
		} else {
			console.info('Executed in {{' + (Date.now() - startTime) + 'ms}}');
		}
	});
};