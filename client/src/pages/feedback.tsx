import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Feedback() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Share Your Feedback
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Help us improve Catalog Pilot by sharing your thoughts, suggestions, and experiences.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.5 12.5L10.5 14.5L15.5 9.5M7 3.33782C8.47087 2.48697 10.1786 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 10.1786 2.48697 8.47087 3.33782 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Feedback Form
            </CardTitle>
            <CardDescription>
              Your feedback is valuable to us. Please take a moment to share your experience with Catalog Pilot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full" style={{ minHeight: '600px' }}>
              <iframe 
                src="https://ultra-mistake-4c3.notion.site/ebd/24e09468acb0801081d4d5dc3e1e8491" 
                width="100%" 
                height="600" 
                frameBorder="0" 
                allowFullScreen
                className="rounded-lg border border-gray-200 dark:border-gray-700"
                title="Catalog Pilot Feedback Form"
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            What We're Looking For
          </h3>
          <ul className="space-y-2 text-blue-800 dark:text-blue-200">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>Feature requests and suggestions for improvement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>User experience feedback and usability issues</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>Bug reports and technical problems</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>General thoughts on the application and workflow</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}