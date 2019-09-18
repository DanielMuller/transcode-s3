'use strict'
const log = require('lambda-log')
const AWS = require('aws-sdk')
const path = require('path')
var mc = null

module.exports.handler = async (event) => {
  const fileInfo = event.Records[0]
  log.options.meta.sourceIp = fileInfo.requestParameters.sourceIPAddress
  log.options.meta.requestId = fileInfo.responseElements['x-amz-request-id']
  log.options.meta.Id2 = fileInfo.responseElements['x-amz-id-2']

  log.info('Event', { event: event })

  const endpoint = await new AWS.MediaConvert().describeEndpoints().promise().then(res => {
    return res.Endpoints[0].Url
  })

  AWS.config.mediaconvert = { endpoint: endpoint }
  mc = new AWS.MediaConvert()
  const job = require('../lib/job.js')
  const input = require('../lib/templates/input.json')
  const outputBase = require('../lib/templates/output.json')

  const ext = path.extname(fileInfo.s3.object.key)
  const basename = path.basename(fileInfo.s3.object.key, ext)

  input.FileInput = `s3://${fileInfo.s3.bucket.name}/${fileInfo.s3.object.key}`
  job.Role = process.env.MediaConvertRole
  job.Settings.Inputs[0] = input
  job.Settings.OutputGroups[0].OutputGroupSettings.FileGroupSettings.Destination = `s3://${fileInfo.s3.bucket.name}/${process.env.outPrefix}/${basename}/${basename}`

  const outputs = require('../lib/outputs.js')
  outputs.forEach(outputSettings => {
    const output = JSON.parse(JSON.stringify(outputBase))
    output.NameModifier = `-${outputSettings.Height}p`
    output.VideoDescription.Width = outputSettings.Width
    output.VideoDescription.Height = outputSettings.Height
    output.VideoDescription.CodecSettings.H264Settings.MaxBitrate = parseInt(outputSettings.Bitrate)
    output.VideoDescription.CodecSettings.H264Settings.HrdBufferSize = 2 * parseInt(outputSettings.Bitrate)
    output.VideoDescription.CodecSettings.H264Settings.CodecLevel = (outputSettings.Height >= 1080) ? 'LEVEL_4_2' : 'LEVEL_3_1'
    output.VideoDescription.CodecSettings.H264Settings.CodecProfile = (outputSettings.Height >= 1080) ? 'HIGH' : 'MAIN'
    output.VideoDescription.CodecSettings.H264Settings.NumberBFramesBetweenReferenceFrames = (outputSettings.Height < 720) ? 3 : 1
    job.Settings.OutputGroups[0].Outputs.push(output)
  })

  log.info('Job', { job: job })
  return startJob(job)
}

const startJob = (params) => {
  return mc.createJob(params).promise().then(res => {
    return res
  }).catch(err => {
    log.error('createJob', err)
    return false
  })
}
