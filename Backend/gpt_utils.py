import os
import json
import logging
from openai import AzureOpenAI

logger = logging.getLogger(__name__)


def get_openai_client():
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT_URL")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    subscription_key = os.getenv("AZURE_OPENAI_API_KEY")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION")

    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=subscription_key,
        api_version=api_version,
        azure_deployment=deployment,
    )

    return client, deployment


openai_client, openai_model = get_openai_client()


def get_gpt_response(messages):
    completion = openai_client.chat.completions.create(
        model=openai_model,
        messages=messages,
        temperature=0.73,
        top_p=0.88,
        frequency_penalty=0,
        presence_penalty=0,
        stop=None,
        stream=False,
    )

    completion_json = completion.to_json()
    logger.debug(f"GPT Completion Response: {completion_json}")

    completion_json = json.loads(completion_json)

    if "choices" in completion_json:
        response = completion_json["choices"][0]["message"]["content"]
        # remove ```json from front and ``` from end if present
        response = response[6:] if response.startswith("```json") else response
        response = response[:-3] if response.endswith("```") else response
        return response
    else:
        logger.error("No valid response from GPT.")
        return None


def identify_relevant_nodes_from_user_input(
    user_input, nodes, find_relevant_nodes_prompt
):
    messages = [
        {
            "role": "system",
            "content": find_relevant_nodes_prompt,
        },
        {
            "role": "user",
            "content": f"User input: '{user_input}'. Available nodes: {nodes}.",
        },
    ]

    response = get_gpt_response(messages)
    logger.info(f"Response from GPT: {response}")

    if response is None:
        return []

    return json.loads(response)
