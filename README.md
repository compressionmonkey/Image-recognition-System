# steps to run the project

## Without Encryption
check encryptedVercelConfig.txt file
"dest": process.env.NODE_ENV === "development" ? "/public/index.js" : "/public/dist/index.min.js",

make change while in localhost not in vercel
## With Encryption
follow current vercel.json file