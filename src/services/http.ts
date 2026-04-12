import axios from 'axios'

export const http = axios.create({
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})
