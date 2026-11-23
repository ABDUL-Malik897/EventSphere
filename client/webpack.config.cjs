
const path = require("node:path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

require("dotenv").config({
    path: path.resolve(__dirname, ".env")
});

const apiUrl =
    process.env.VITE_API_URL || "http://localhost:5000/api";

module.exports = (_env, argv) => {
    const isProduction = argv.mode === "production";

    return {
        mode: isProduction ? "production" : "development",

        entry: path.resolve(__dirname, "src/main.jsx"),

        output: {
            path: path.resolve(__dirname, "dist"),
            filename: "assets/[name].[contenthash].js",
            assetModuleFilename: "assets/[name].[contenthash][ext]",
            publicPath: "/",
            clean: true
        },

        resolve: {
            extensions: [".js", ".jsx"]
        },

        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            presets: [
                                [
                                    "@babel/preset-env",
                                    { targets: "defaults" }
                                ],
                                [
                                    "@babel/preset-react",
                                    { runtime: "automatic" }
                                ]
                            ]
                        }
                    }
                },
                {
                    test: /\.css$/i,
                    use: ["style-loader", "css-loader"]
                },
                {
                    test: /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i,
                    type: "asset/resource"
                }
            ]
        },

        plugins: [
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, "index.html")
            }),

            new webpack.DefinePlugin({
                "process.env.VITE_API_URL": JSON.stringify(apiUrl)
            })
        ],

        devtool: isProduction ? "source-map" : "eval-source-map",

        devServer: {
            host: "localhost",
            port: 5173,
            hot: true,
            historyApiFallback: true,
            static: {
                directory: path.resolve(__dirname, "public")
            }
        }
    };
};
