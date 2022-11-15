import path from 'path'

import {
  input as inputTemplate,
  job as jobTemplate,
  output as outputTemplate,
  outputs as outputsFormats,
} from '@@shared/templates/mediaconvert'
import {
  CreateJobCommand,
  DescribeEndpointsCommand,
  type Job,
  MediaConvertClient,
  type Output,
} from '@aws-sdk/client-mediaconvert'
import { S3Path } from 'local-ts'
import { Utils } from 'utils-ts'

let client = new MediaConvertClient({})

interface CreateJob {
  bucket: string
  key: string
  outPrefix: string
  mediaConvertRole: string
  region: string
}

/**
 * Prepare config for Mediaconvert Job from the file input and templates
 */
export async function createJob(
  params: CreateJob,
  context: Utils.Context,
): Promise<Job | undefined> {
  const { key, bucket, outPrefix, mediaConvertRole } = params

  if (!client.config.endpoint) {
    const endpointCommand = new DescribeEndpointsCommand({ Mode: 'DEFAULT' })
    const { Endpoints } = await client.send(endpointCommand)
    if (Endpoints && Endpoints[0] && Endpoints[0].Url) {
      client = new MediaConvertClient({ region: params.region, endpoint: Endpoints[0].Url })
    }
  }
  const ext = path.extname(key)
  const basename = path.basename(key, ext)
  const dirname = path.dirname(key).split('/').slice(1).join('/')
  const outputPrefix = path.join(outPrefix, dirname, basename)

  const fileInput: S3Path = `s3://${bucket}/${key}`
  const fileOutput: S3Path = `s3://${bucket}/${outputPrefix}/${basename}`

  const outputs = buildOutputs()

  inputTemplate.FileInput = fileInput

  const job = { ...jobTemplate }
  job.Role = mediaConvertRole
  if (!job.Settings) {
    job.Settings = {}
  }
  if (!job.Settings.Inputs) {
    job.Settings.Inputs = []
  }
  job.Settings.Inputs[0] = inputTemplate

  if (
    job.Settings.OutputGroups &&
    Array.isArray(job.Settings.OutputGroups) &&
    job.Settings.OutputGroups[0] &&
    job.Settings.OutputGroups[0].OutputGroupSettings &&
    job.Settings.OutputGroups[0].OutputGroupSettings.FileGroupSettings
  ) {
    job.Settings.OutputGroups[0].OutputGroupSettings.FileGroupSettings.Destination = fileOutput
  } else {
    job.Settings.OutputGroups = [
      {
        OutputGroupSettings: {
          FileGroupSettings: {
            Destination: fileOutput,
          },
        },
      },
    ]
  }
  job.Settings.OutputGroups[0].Outputs = outputs

  context.logger.info('Job', { job })

  const command = new CreateJobCommand(job)
  const response = await client.send(command)
  return response.Job
}

/**
 * Build Outputs from template
 */
function buildOutputs(): Output[] {
  const outputs: Output[] = []

  outputsFormats.forEach((outputSettings) => {
    const output: Output = JSON.parse(JSON.stringify(outputTemplate))
    output.NameModifier = `-${outputSettings.Height}p`
    if (!output.VideoDescription) {
      output.VideoDescription = {}
    }
    output.VideoDescription.Width = outputSettings.Width
    output.VideoDescription.Height = outputSettings.Height
    if (!output.VideoDescription.CodecSettings) {
      output.VideoDescription.CodecSettings = {}
    }
    if (!output.VideoDescription.CodecSettings.H264Settings) {
      output.VideoDescription.CodecSettings.H264Settings = {}
    }

    output.VideoDescription.CodecSettings.H264Settings.MaxBitrate = Number(outputSettings.Bitrate)
    output.VideoDescription.CodecSettings.H264Settings.HrdBufferSize =
      2 * Number(outputSettings.Bitrate)
    output.VideoDescription.CodecSettings.H264Settings.CodecLevel =
      outputSettings.Height >= 1080 ? 'LEVEL_4_2' : 'LEVEL_3_1'
    output.VideoDescription.CodecSettings.H264Settings.CodecProfile =
      outputSettings.Height >= 1080 ? 'HIGH' : 'MAIN'
    output.VideoDescription.CodecSettings.H264Settings.NumberBFramesBetweenReferenceFrames =
      outputSettings.Height < 720 ? 3 : 1
    outputs.push(output)
  })
  return outputs
}
