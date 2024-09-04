import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  const formData = await request.formData();
  const file = formData.get('file');

  // Process the file here
  // This is where you'd implement your server-side logic to handle the ZIP file

  // For now, we'll just return a mock response
  const mockMessages = [
    {
      ID: 1,
      Name: "John Doe",
      Time: "10:00",
      Date: "2023-05-01",
      Message: "Hello, this is a test message.",
      FileAttached: null
    },
    {
      ID: 2,
      Name: "Jane Smith",
      Time: "10:05",
      Date: "2023-05-01",
      Message: "Hi John, this is a response.",
      FileAttached: null
    }
  ];

  return json(mockMessages);
}