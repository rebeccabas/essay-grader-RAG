from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import faiss
import numpy as np
import json
import pickle
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from dotenv import load_dotenv
from sklearn.preprocessing import normalize

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Adjust this to match your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Helper functions
def get_embedding(text, model="text-embedding-3-small"):
    text = text.replace("\n", " ")
    return client.embeddings.create(input=[text], model=model).data[0].embedding

def load_faiss_index(filename):
    return faiss.read_index(filename)

def load_metadata(filename):
    with open(filename, 'rb') as f:
        return pickle.load(f)

# Load FAISS index and metadata
index_file = 'essay_index.faiss'
metadata_file = 'essay_metadata.pkl'

index = load_faiss_index(index_file)
essay_metadata = load_metadata(metadata_file)

# Define request model
class EssayRequest(BaseModel):
    essay: str

def query_faiss_index(query_text, index, metadata, k=2):
    query_vector = get_embedding(query_text, model="text-embedding-ada-002")
    query_vector = np.array(query_vector).reshape(1, -1).astype('float32')
    query_vector = normalize(query_vector)
    D, I = index.search(query_vector, k)
    similar_essays = [metadata[i] for i in I[0]]
    return similar_essays, D[0]

def clean_essay(input_essay):
    instruction = (
        "Remove any jargonous symbols from the following essay if any, but do not correct any other mistakes. "
        "Return the essay with no other changes."
    )

    prompt_template = PromptTemplate(
        input_variables=["instruction", "input_essay"],
        template="""
        {instruction}

        Input Essay: {input_essay}

        Return the cleaned essay only with no extra description.
        """
    )

    llm = ChatOpenAI(temperature=0.0, max_tokens=1000)
    chain = LLMChain(llm=llm, prompt=prompt_template)

    try:
        result = chain.run({
            "instruction": instruction,
            "input_essay": input_essay
        })
        return result.strip()  # Return the cleaned essay
    except Exception as e:
        print(f"An error occurred during essay cleaning: {str(e)}")
        return None

def score_essay(essay_prompt, essay_rubrics, reference_essay, reference_scores, input_essay):
    instruction = (
        "You are an AI essay scorer. Your task is to evaluate the input essay based on the provided essay prompt, reference essays, and their scores. "
        "Use the reference essay and its scores as a guide for your evaluation. "
        "Provide scores for each trait along with a final score. "
        "Return your score strictly in the JSON format specified in the scoring_format."
    )

    prompt_template = PromptTemplate(
        input_variables=["instruction", "essay_prompt", "rubrics", "reference_essay", "scoring_format", "input_essay"],
        template="""
        {instruction}

        Essay Prompt: {essay_prompt}

        Reference Essay: {reference_essay}

        Scoring Format: {scoring_format}

        Input Essay: {input_essay}

        Please provide your scoring in the specified JSON format.
        """
    )

    llm = ChatOpenAI(temperature=0.0, max_tokens=4096)
    chain = LLMChain(llm=llm, prompt=prompt_template)

    try:
        result = chain.run({
            "instruction": instruction,
            "essay_prompt": essay_prompt,
            "rubrics": essay_rubrics,
            "reference_essay": reference_essay,
            "scoring_format": json.dumps(reference_scores),
            "input_essay": input_essay
        })
        return json.loads(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
def generate_essay_feedback(essay_prompt, essay_rubrics, reference_essay, reference_feedback, input_essay):
    if not all([essay_prompt, essay_rubrics, reference_essay, reference_feedback, input_essay]):
        raise ValueError("All input parameters must be provided")

    instruction = (
        "You are an AI essay reviewer. Your task is to provide feedback for the input essay based on the provided essay prompt, rubrics, reference essays. "
        "Use the reference essay and its as a guide for your evaluation. "
        "Give feedback for each trait (Ideas, Organization, Style, and Conventions) without scores. "
        "Focus on evaluating how well the input essay adheres to the rubrics."
        "Return your feedback strictly in JSON format, based on the feedback_format."
    )

    cleaned_essay = clean_essay(input_essay)
    if not cleaned_essay:
        raise ValueError("Failed to clean the input essay.")

    prompt_template = PromptTemplate(
        input_variables=["instruction", "essay_prompt", "rubrics", "reference_essay", "feedback_format", "input_essay"],
        template="""{instruction}

Essay Prompt: {essay_prompt}

Rubrics: {rubrics}

Reference Essay: {reference_essay}

Reference Feedback: {feedback_format}

Input Essay: {input_essay}

Please provide your feedback in the specified JSON format.
"""
    )

    llm = ChatOpenAI(temperature=0.0, max_tokens=4096)
    chain = LLMChain(llm=llm, prompt=prompt_template)

    try:
        result = chain.run({
            "instruction": instruction,
            "essay_prompt": essay_prompt,
            "rubrics": essay_rubrics,
            "reference_essay": reference_essay,
            "feedback_format": json.dumps(reference_feedback),
            "input_essay": cleaned_essay
        })
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            print("Model didn't return valid JSON. Raw output:", result)
            return None
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return None

# Define constants
essay_prompt = """Write about patience. Being patient means that you are understanding and tolerant. A patient person experiences difficulties without complaining. Do only one of the following: write a story about a time when you were patient OR write a story about a time when someone you know was patient OR write a story in your own way about patience."""

essay_rubrics = """
Rating on the following four traits (0-3 scale):

**Ideas** (points doubled)
- Score 3: Tells a story with ideas that are clearly focused on the topic and are thoroughly developed with specific, relevant details.
- Score 2: Tells a story with ideas that are somewhat focused on the topic and are developed with a mix of specific and/or general details.
- Score 1: Tells a story with ideas that are minimally focused on the topic and developed with limited and/or general details.
- Score 0: Ideas are not focused on the task and/or are undeveloped.

**Organization**
- Score 3: Organization and connections between ideas and/or events are clear and logically sequenced.
- Score 2: Organization and connections between ideas and/or events are logically sequenced.
- Score 1: Organization and connections between ideas and/or events are weak.
- Score 0: No organization evident.

**Style**
- Score 3: Command of language, including effective and compelling word choice and varied sentence structure, clearly supports the writer's purpose and audience.
- Score 2: Adequate command of language, including effective word choice and clear sentences, supports the writer's purpose and audience.
- Score 1: Limited use of language, including lack of variety in word choice and sentences, may hinder support for the writer's purpose and audience.
- Score 0: Ineffective use of language for the writer's purpose and audience.

**Conventions**
- Score 3: Consistent, appropriate use of conventions of Standard English for grammar, usage, spelling, capitalization, and punctuation for the grade level.
- Score 2: Adequate use of conventions of Standard English for grammar, usage, spelling, capitalization, and punctuation for the grade level.
- Score 1: Limited use of conventions of Standard English for grammar, usage, spelling, capitalization, and punctuation for the grade level.
- Score 0: Ineffective use of conventions of Standard English for grammar, usage, spelling, capitalization, and punctuation.

**Adjudication Rules:**
- Scores summed independently for Rater_1 and Rater_2.
- Resolved Score = Rater_1 + Rater_2.
"""

reference_scores = {
  'rater1_domain1': 7.0,
  'rater2_domain1': 8.0,
  'domain1_score': 15.0,
  'rater1_trait1': 1.0,
  'rater1_trait2': 2.0,
  'rater1_trait3': 2.0,
  'rater1_trait4': 2.0,
  'rater2_trait1': 2.0,
  'rater2_trait2': 2.0,
  'rater2_trait3': 2.0,
  'rater2_trait4': 2.0
}

reference_feedback = {
  'Ideas': "feedback",
  'Organization': "feedback",
  'Style': "feedback",
  'Conventions': "feedback"
}

# API endpoints
@app.post("/score-essay")
async def score_essay_endpoint(request: EssayRequest):
    input_essay = request.essay
    reference_essay, distances = query_faiss_index(input_essay, index, essay_metadata, k=2)
    predicted_scores = score_essay(essay_prompt, essay_rubrics, reference_essay, reference_scores, input_essay)
    return predicted_scores

@app.post("/generate-feedback")
async def generate_feedback_endpoint(request: EssayRequest):
    input_essay = request.essay
    reference_essay, distances = query_faiss_index(input_essay, index, essay_metadata, k=2)
    feedback = generate_essay_feedback(essay_prompt, essay_rubrics, reference_essay, reference_feedback, input_essay)
    if feedback is None:
        raise HTTPException(status_code=500, detail="Failed to generate feedback")
    return feedback

# Run the FastAPI application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)