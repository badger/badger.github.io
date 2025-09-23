import { defineCollection, z } from 'astro:content'

/**
 * Content Collections Configuration
 * Defines the schema for different types of content in the site
 */

const hacksCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    duration: z.number(), // in minutes
    tags: z.array(z.string()),
    thumbnail: z.string(),
    author: z.string(),
    date: z.string(),
    hardware: z.array(z.string()),
    github: z.string().url(),
  }),
})

export const collections = {
  hacks: hacksCollection,
}