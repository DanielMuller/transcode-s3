declare namespace NodeJS {
  export interface ProcessEnv {
    AWS_REGION: string
    region: string
    MediaConvertRole: `arn:aws:iam::${string}:role/${string}Role${string}`
    outPrefix: string
  }
}
