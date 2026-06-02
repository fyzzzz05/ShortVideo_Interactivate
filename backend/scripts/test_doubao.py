from openai import OpenAI

from config import get_ark_api_key, get_ark_base_url, get_ark_model


def main() -> None:
    client = OpenAI(api_key=get_ark_api_key(), base_url=get_ark_base_url())

    response = client.chat.completions.create(
        model=get_ark_model(),
        messages=[
            {"role": "system", "content": "你是短剧剧情高光识别助手。"},
            {
                "role": "user",
                "content": "判断这句短剧台词是不是高光：你以为我是普通人？其实整个沈家都是我的。请简短回答。",
            },
        ],
        temperature=0.2,
    )

    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()

