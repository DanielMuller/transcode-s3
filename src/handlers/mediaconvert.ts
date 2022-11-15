import { createJob } from '@@controllers/mediaconvert'
import { S3Event } from 'aws-lambda'
import { LambdaLog } from 'lambda-log'

const LOCAL_ENV_VARIABLES = {
  region: process.env.AWS_REGION,
  MediaConvertRole: process.env.MediaConvertRole,
  outPrefix: process.env.outPrefix,
}

const main = async (event: S3Event): Promise<string> => {
  const fileInfo = event.Records[0]
  const logger = new LambdaLog({
    meta: {
      sourceIp: fileInfo.requestParameters.sourceIPAddress,
      requestId: fileInfo.responseElements['x-amz-request-id'],
      Id2: fileInfo.responseElements['x-amz-id-2'],
    },
  })

  logger.info('Event', { event, env: process.env })

  const key = decodeURIComponent(fileInfo.s3.object.key.replace(/\+/g, ' '))
  const bucket = fileInfo.s3.bucket.name

  const response = await createJob(
    {
      bucket,
      key,
      outPrefix: LOCAL_ENV_VARIABLES.outPrefix,
      mediaConvertRole: LOCAL_ENV_VARIABLES.MediaConvertRole,
      region: LOCAL_ENV_VARIABLES.region || '',
    },
    { logger },
  )
  logger.info('response', { response })
  return 'string'
}
export const handler = main
