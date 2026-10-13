import { useEffect, useState } from 'react';
import type { Taxonomy } from '../shared/schema';
import type { ImageQuestion } from '../shared/image-question';
import { api } from './api';
import { useAuth } from './Auth';
export function Preview({ tax, id }: { tax: Taxonomy; id: string }) {
  const { session } = useAuth(),
    [q, setQ] = useState<ImageQuestion>(),
    [error, setError] = useState(''),
    [showAnswer, setShowAnswer] = useState(false);
  useEffect(() => {
    void api<ImageQuestion>('/questions/' + id)
      .then(setQ)
      .catch((e) => setError(e.message));
  }, [id]);
  async function answer() {
    try {
      setQ(await api<ImageQuestion>('/questions/' + id + '?answers=true'));
      setShowAnswer(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {q && (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">QUESTION PREVIEW</p>
              <h1>{tax.topics.find((t) => t.id === q.topicId)?.name ?? 'Question'}</h1>
              <p>
                {q.totalMarks} marks ?{' '}
                {tax.difficulties.find((d) => d.id === q.difficultyId)?.name.toUpperCase()}
              </p>
              <code>{q.id}</code>
            </div>
            <a className="button" href="/">
              Question bank
            </a>
            {session.user?.role === 'admin' && (
              <a className="button" href={'/edit/' + q.id}>
                Edit question
              </a>
            )}
          </div>
          <section className="panel">
            <h2>Question</h2>
            <img
              className="academic-image"
              src={q.questionImage.url}
              width={q.questionImage.width}
              height={q.questionImage.height}
              alt="Question image"
            />
          </section>
          {!showAnswer ? (
            <button className="button" onClick={() => void answer()}>
              Show answer / marking scheme
            </button>
          ) : (
            q.answerImage && (
              <section className="panel">
                <h2>Answer / marking scheme</h2>
                <img
                  className="academic-image"
                  src={q.answerImage.url}
                  width={q.answerImage.width}
                  height={q.answerImage.height}
                  alt="Answer image"
                />
              </section>
            )
          )}
        </>
      )}
    </>
  );
}
