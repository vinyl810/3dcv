import Experience from '@/components/Experience';
import { getMarks, dbEnabled } from '@/lib/marks';

export default async function Page() {
  const { marks, total } = await getMarks();
  return <Experience initialMarks={marks} total={total} dbEnabled={dbEnabled()} />;
}
