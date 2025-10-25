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
    featured: z.union([z.literal(false), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  }),
})

const appsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string(), // path to icon image
    category: z.enum(['utility', 'game', 'productivity', 'fun']),
    preloaded: z.boolean(), // whether it comes preloaded on the badge
    customizable: z.boolean(), // whether users can customize it
    fileLocation: z.string(), // where it lives on the badge filesystem
  }),
})

export const collections = {
  hacks: hacksCollection,
  apps: appsCollection,
}