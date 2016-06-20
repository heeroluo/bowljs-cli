/*!
 * Command line tools for Bowljs
 * Document member classes (2016-06-20T10:53:20+0800)
 * http://jraiser.org/ | Released under LGPL license
 */

'use strict';

var util = require('./util');


// 成员抽象类
// 为避免与关键字、保留字冲突，所有变量名前均加了$，下同
var $Member = util.createClass(function(obj) {
	var t = this;
	// 成员名
	t.$name = obj.$name;
	// 成员描述
	t.$description = obj.$description;
	// 所属
	t.$for = obj.$for;

	// 特性
	if (obj.$features) {
		t.$features = [ ];

		var tmp = { };
		obj.$features.forEach(function(f) {
			if (!tmp[f]) {
				t.$features.push(f);
				tmp[f] = true;
			}
		});
	}
});


function createArray(obj, propName) {
	obj[propName] = obj[propName] || [ ];
	return obj[propName];
}


// 类成员
var $Class = util.createClass(function(obj) {
	// 记录父类
	this.$extends = obj.$extends;
}, {
	// 添加成员
	_addMember: function(member) {
		createArray(this, '$members').push(member);
	},
	// 添加类
	addClass: function(member) {
		createArray(this, '$classes').push(member);
		this._addMember(member);
	},
	// 添加方法
	addMethod: function(member) {
		createArray(this, '$methods').push(member);
		this._addMember(member);
	},
	// 添加属性
	addProperty: function(member) {
		createArray(this, '$properties').push(member);
		this._addMember(member);
	},
	// 添加事件
	addEvent: function(member) {
		createArray(this, '$events').push(member);
	},
	// 添加构造函数
	addConstructor: function(member) {
		createArray(this, '$constructors').push(member);
	},
	// 添加到父级
	appendTo: function(parent) {
		parent.addClass(this);
	},
	// 通过名字查找成员
	getMemberByName: function(name) {
		if (this.$members) {
			return this.$members.filter(function(m) {
				return m.$name === name;
			})[0];
		}
	},
	// 替换属性
	replaceWith: function(member) {
		this.$description = this.$description || member.$description;
		this.$extends = this.$extends || member.$extends;
		if (member.$features) {
			if (this.$features) {
				this.$features = util.literalUnique( util.merge(this.$features, member.$features) );
			} else {
				this.$features = member.$features.slice();
			}
		}
	}
}, $Member);


// 方法成员
var $Method = util.createClass(function(obj) {
	// 函数重载列表
	this.$implements = [{
		$description: this.$description,
		$features: this.$features,
		$params: obj.$params,		// 参数列表
		$optional: obj.$optional,	// 是否可选参数
		$default: obj.$default,		// 默认值
		$return: obj.$return,		// 返回值
	}];

	// 这些属性不用保留了
	delete this.$description;
	delete this.$features;
}, {
	// 添加到父级
	appendTo: function(parent) { parent.addMethod(this); },
	// 增加重载
	addImplement: function(member) {
		util.merge(this.$implements, member.$implements);
	}
}, $Member);


// 构造函数成员
var $Constructor = util.createClass(function(obj) {

}, {
	// 添加到父成员
	appendTo: function(parent) { parent.addConstructor(this); }
}, $Method);


// 属性成员
var $Property = util.createClass(function(obj) {
	// 类型
	this.$type = obj.$type;
}, {
	// 添加到父成员
	appendTo: function(parent) { parent.addProperty(this); }
}, $Member);


// 事件成员
var $Event = util.createClass(function(obj) {
	// 参数列表
	this.$params = obj.$params;
}, {
	// 添加到父成员
	appendTo: function(parent) { parent.addEvent(this); }
}, $Member);


// 模块
var $Module = util.createClass(function(obj) {
	this.$category = obj.$category;	// 分类
	this.$include = obj.$include;	// 外部注释列表
	this.$ignore = obj.$ignore;		// 是否不生成此模块的文档
	this.$see = obj.$see;			// 文档跳转到外部链接

	$Class.apply(this, arguments);
}, {
	createMember: function(obj) {
		var member;

		switch (obj.$tag) {
			case 'class':
				delete obj.$for;	// 暂不支持多层级类
				member = new $Class(obj);
				var existingMember = this.getMemberByName(obj.$name);
				if (existingMember) {
					existingMember.replaceWith(member);
					member = existingMember;
				}
			break;

			case 'method':
				member = new $Method(obj);
			break;

			case 'property':
				member = new $Property(obj);
			break;

			case 'event':
				member = new $Event(obj);
			break;

			case 'constructor':
				member = new $Constructor(obj);
			break;
		}

		if (member) {
			// 寻找父成员
			var parent = member.$for ? this.getMemberByName(member.$for) : this;
			if (!parent) {
				// 如果父成员不存在，创建之
				parent = this.createMember({
					$name: member.$for,
					$tag: 'class'
				});
			}

			var existingMember = parent.getMemberByName(member.$name);
			if (existingMember) {
				// 同名函数，添加为重载
				if (member.addImplement && existingMember.addImplement) {
					existingMember.addImplement(member);
				}
			} else {
				member.appendTo(parent);
			}
		}

		return member;
	}
}, $Class);


util.extend(exports, {
	$Member: $Member,
	$Class: $Class,
	$Method: $Method,
	$Constructor: $Constructor,
	$Property: $Property,
	$Event: $Event,
	$Module: $Module
});