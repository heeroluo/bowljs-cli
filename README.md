# Bowljs CLI(Command Line Interface)

Bowljs CLI为基于Bowl.js的模块化开发提供工具支持。

## 安装

Bowljs CLI运行于Node.js环境，您必须先安装Node.js（4.0.0或以上版本），然后在命令行中输入：

	npm install bowljs-cli -g

## 使用

### 构建

为了提高性能，发布到生产环境的Javascript代码一般要经过**压缩处理**，甚至要对一些文件进行**合并**。Bowljs CLI提供了构建工具完成上述工作。该工具的最简单用法是：

    bowljs build <目标路径>

其中「目标路径」参数可以是一个文件或者一个目录，为目录时则构建该目录下的所有文件。要注意的是，构建工具只会对开发版本的文件（文件名为「*-debug.js」）进行构建，其他文件会被忽略。构建结果即同目录下不带「-debug」的文件（生产版本），例如「ajax-debug.js」的编译结果为「ajax.js」。

构建工具还可以在构建模块的时候把所有或部分依赖的模块合并进来，以节省HTTP请求。合并功能需要一个配置文件指定合并规则（详见[此处](//github.com/heeroluo/bowljs-cli/wiki/%E6%9E%84%E5%BB%BA%E9%85%8D%E7%BD%AE)）。

在执行`bowljs build`命令的时候，如果「目标路径」参数是一个目录并且该目录下有一个叫做「package.settings」的文件，那么该文件就会被自动加载为配置文件。否则就需要指定配置文件路径：

    bowljs build <目标路径> --settings <配置文件路径>

### 生成文档

API文档有助于团队成员了解各个模块的功能。通过Bowljs CLI的文档生成工具，只要把文档的内容以特定格式的注释（规则见[此处](//github.com/heeroluo/bowljs-cli/wiki/%E6%96%87%E6%A1%A3%E6%B3%A8%E9%87%8A%E6%A0%87%E7%AD%BE)）写在源代码中，就可以批量生成文档。

生成文档同样需要一个配置文件，配置项见[此处](//github.com/heeroluo/bowljs-cli/wiki/%E6%96%87%E6%A1%A3%E7%94%9F%E6%88%90%E9%85%8D%E7%BD%AE)。把该配置文件保存为`document.settings`，并放置于目标目录下，然后执行以下命令就可以生成文档：

    bowljs doc <目标目录>

如果配置文件不在目标目录下，也可以通过参数指定其路径：

    bowljs doc <目标目录> --settings <配置文件路径>
