# Automatically Transcode new files uploaded to S3
Transcodes any new uploaded file to S3 into 3 formats using [AWS MediaConvert](https://aws.amazon.com/mediaconvert/):
- 1080p
- 720p
- 480p

Source files are assumed to be at least 1920x1080 in 16:9

This project uses [serverless.com](https://serverless.com/) with [serverless-template-aws-webpack-nodejs](https://github.com/Spuul/serverless-template-aws-webpack-nodejs).

## Setup
You need to have [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) installed and setup with [profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).
```
git clone https://github.com/DanielMuller/transcode-s3.git
cd transcode-s3/
npm i
cp -a stages/production.sample.yml stages/production.yml
```

Edit `stages/production.yml` to adapt to your needs:
- **profile**: AWS profile used for deployment
- **region**: Region to deploy to. The region needs to have MediaConvert enabled
- **suffix**: Suffix used to name the function. For production, an empty string works well
- **bucket**: Name of the bucket where files will be uploaded and transcoded files stored
- **inPrefix**: Prefix (folder) for triggering transcode jobs
- **outPrefix**: Prefix (folder) where transcoded files be stored. Needs to be different from *inPrefix* to avoid this files from being transcoded again.
- **bucketTags**: Additional tags to set on the bucket

## deploy
```
npm run deploy
```

## Usage
```
aws s3 cp my-file.mp4 s3://my-bucket/auto/my-file.mp4
```

Result will be available at:
- s3://my-bucket/my-file/my-file-1080p.mp4
- s3://my-bucket/my-file/my-file-720p.mp4
- s3://my-bucket/my-file/my-file-480p.mp4

## Bucket settings
- Transfer acceleration is enabled.
- Files uploaded to `/${inPrefix}/` will be transcoded.
- Results will be stored in `/${outPrefix}/${basename}/${basename}-${size}p.mp4`
- Lifecycle Rules: Files in `/${inPrefix}/` will be deleted after 2 days
- Lifecycle Rules: Files in `/${outPrefix}/` will be deleted after 14 days
- Objects can't have a public ACL. To download them, you need a signed URL
