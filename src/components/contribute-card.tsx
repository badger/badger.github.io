import { Plus, Github } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Contribute Card Component
 * Encourages users to contribute their own hacks
 */
export function ContributeCard() {
  const handleContributeClick = () => {
    window.location.href = '/contribute'
  }

  const handleGitHubClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    window.open('https://github.com/badger/hackshelf', '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="group border-dashed border-2 hover:border-solid hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 cursor-pointer"
          onClick={handleContributeClick}>
      <CardHeader className="text-center pb-3">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Plus className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-xl">Share Your Hack</CardTitle>
        <CardDescription>
          Built something awesome with your Badger 2350? Share it with the community!
        </CardDescription>
      </CardHeader>

      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Help others learn by contributing your own hacks, tutorials, and projects.
        </p>

        <div className="space-y-2">
          <Button 
            className="w-full pointer-events-none"
            variant="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Contribute Now
          </Button>

          <Button 
            variant="outline"
            className="w-full"
            onClick={handleGitHubClick}
          >
            <Github className="h-4 w-4 mr-2" />
            View on GitHub
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}